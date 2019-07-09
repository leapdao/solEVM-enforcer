const ethers = require('ethers');
const debug = require('debug')('vgame-test');
const assert = require('assert');

const { Merkelizer, ExecutionPoker, Constants } = require('./../../utils');
const disputeFixtures = require('./../fixtures/dispute');
const { onchainWait, deployContract, deployCode, wallets, provider } = require('./../helpers/utils');

const Verifier = require('./../../build/contracts/Verifier.json');
const Enforcer = require('./../../build/contracts/Enforcer.json');

const SOLVER_VERIFIED = (1 << 2);

const EVMParameters = {
  origin: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  target: '0xfeefeefeefeefeefeefeefeefeefeefeefeefee0',
  blockHash: '0xdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdc',
  blockNumber: 123,
  time: 1560775755,
  txGasLimit: 0xffffffffff,
  customEnvironmentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  dataHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
};

class MyExecutionPoker extends ExecutionPoker {
  async submitRound (disputeId) {
    try {
      await super.submitRound(disputeId);
    } catch (e) {
      // ignore
    }
  }

  async submitProof (disputeId, computationPath) {
    try {
      await super.submitProof(disputeId, computationPath);
    } catch (e) {
      // ignore
    }

    this.afterSubmitProof(disputeId);
  }

  async computeCall (evmParams, invalidateLastStep) {
    return { steps: this._steps, merkle: this._merkle };
  }

  async requestExecution (contractAddr, callData) {
    const codeHash = `0x${contractAddr.replace('0x', '').toLowerCase().padEnd(64, '0')}`;
    const dataHash = Merkelizer.dataHash(callData);
    const evmParams = Object.assign(EVMParameters, { codeHash, dataHash });

    return super.requestExecution(evmParams, callData);
  }

  log (...args) {
    debug(...args);
  }
}

describe('Verifier', function () {
  let enforcer;
  let verifier;
  let execPokerSolver;
  let execPokerChallenger;

  before(async () => {
    const taskPeriod = 1000000;
    const challengePeriod = 1000;
    const timeoutDuration = 10;
    const bondAmount = 1;
    const maxExecutionDepth = 10;

    verifier = await deployContract(Verifier, timeoutDuration);
    enforcer = await deployContract(
      Enforcer, verifier.address, taskPeriod, challengePeriod, bondAmount, maxExecutionDepth
    );

    let tx = await verifier.setEnforcer(enforcer.address);

    await tx.wait();

    // yes, we need a new provider. Otherwise we get duplicate events...
    const solverWallet = wallets[2].connect(new ethers.providers.JsonRpcProvider(provider.connection.url));
    const challengerWallet = wallets[3].connect(new ethers.providers.JsonRpcProvider(provider.connection.url));
    // let's be faster (events)
    solverWallet.provider.pollingInterval = 30;
    challengerWallet.provider.pollingInterval = 30;

    execPokerSolver = new MyExecutionPoker(
      enforcer,
      verifier,
      solverWallet,
      Constants.GAS_LIMIT,
      'solver'
    );
    after(function (done) {
      done();
      process.exit(0);
    });

    execPokerChallenger = new MyExecutionPoker(
      enforcer,
      verifier,
      challengerWallet,
      Constants.GAS_LIMIT,
      'challenger'
    );
    execPokerChallenger.alwaysChallenge = true;
  });

  disputeFixtures(
    async (code, callData, solverMerkle, challengerMerkle, expectedWinner) => {
      // use merkle tree from fixture
      execPokerSolver._merkle = solverMerkle;
      execPokerSolver._steps = [];
      execPokerChallenger._merkle = challengerMerkle;
      execPokerChallenger._steps = [];

      const codeContract = await deployCode(code);
      const winner = await new Promise(
        (resolve, reject) => {
          let resolved = false;
          let state = 0;

          async function decide (disputeId) {
            state++;
            if (state !== 2) {
              return;
            }

            const dispute = await verifier.disputes(disputeId);
            let winner = 'challenger';
            if ((dispute.state & SOLVER_VERIFIED) !== 0) {
              winner = 'solver';
            }
            if (!resolved) {
              resolved = true;
              resolve(winner);
            }
          }

          execPokerSolver.afterSubmitProof = async (disputeId) => {
            decide(disputeId);
          };
          execPokerChallenger.afterSubmitProof = async (disputeId) => {
            decide(disputeId);
          };
          execPokerSolver.onSlashed = () => {
            if (!resolved) {
              resolved = true;
              resolve('challenger');
            }
          };
          execPokerChallenger.onSlashed = () => {
            if (!resolved) {
              resolved = true;
              resolve('solver');
            }
          };

          execPokerSolver.requestExecution(codeContract.address, callData);
        }
      );

      assert.equal(winner, expectedWinner, 'winner should match fixture');
      await onchainWait(10);
    }
  );
});
