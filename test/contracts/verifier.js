const Merkelizer = require('./../../utils/Merkelizer');
const ProofHelper = require('./../../utils/ProofHelper');
const disputeFixtures = require('./../fixtures/dispute');
const { onchainWait, toBytes32, deployContract, txOverrides } = require('./../helpers/utils');
const OP = require('./../../utils/constants');
const assertRevert = require('./../helpers/assertRevert');
const debug = require('debug')('vgame-test');
const GAS_LIMIT = OP.GAS_LIMIT;

const Verifier = artifacts.require('Verifier.sol');
const Enforcer = artifacts.require('Enforcer.sol');

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ONE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000001';
const TWO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000002';
const ZERO_WITNESS_PATH = { left: ZERO_HASH, right: ZERO_HASH };
const SOLVER_VERIFIED = (1 << 2);
const CHALLENGER_VERIFIED = (1 << 3);

function computeWitnessPath (dispute, merkleTree) {
  const needsWitness = dispute.witness !== ZERO_HASH;

  if (needsWitness) {
    const path = merkleTree.getNode(dispute.witness);

    return { left: path.left.hash, right: path.right.hash };
  }

  return ZERO_WITNESS_PATH;
}

async function submitProofHelper (verifier, disputeId, code, computationPath) {
  const args = ProofHelper.constructProof(computationPath, code.join(''));
  debug('ExecState', args.executionInput);

  let tx = await verifier.submitProof(
    disputeId,
    args.proofs,
    args.executionInput,
    txOverrides
  );

  tx = await tx.wait();

  /*
  tx.events.forEach(
    (ele) => {
      console.log(ele.args);
    }
  );
  */

  return tx;
}

async function disputeGame (
  enforcer, verifier, codeHash, code, callData, solverMerkle, challengerMerkle, expectedWinner, expectedError
) {
  let disputeId;

  try {
    let solverComputationPath = solverMerkle.root;
    let challengerComputationPath = challengerMerkle.root;

    // TODO: handle the bigger case too
    if (solverMerkle.depth < challengerMerkle.depth) {
      challengerComputationPath = challengerMerkle.tree[solverMerkle.depth - 1][0];
    }

    const bondAmount = await enforcer.bondAmount();

    await enforcer.remove(codeHash, callData);
    let tx;

    tx = await enforcer.register(
      codeHash,
      callData,
      solverComputationPath.hash,
      solverMerkle.depth,
      ZERO_HASH,
      { value: bondAmount, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    tx = await enforcer.dispute(
      codeHash,
      callData,
      challengerComputationPath.hash,
      { value: bondAmount, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    let dispute = await tx.wait();
    let event = dispute.events[0].args;

    disputeId = event.disputeId;

    while (true) {
      dispute = await verifier.disputes(event.disputeId);

      if (solverComputationPath.isLeaf && challengerComputationPath.isLeaf) {
        debug('REACHED leaves');

        debug('Solver: SUBMITTING FOR l=' +
          solverComputationPath.left.hash + ' r=' + solverComputationPath.right.hash);
        try {
          await submitProofHelper(verifier, event.disputeId, code, solverComputationPath);
        } catch (err) {
          debug(err);
        }

        // refresh
        dispute = await verifier.disputes(event.disputeId);
        if ((dispute.state & SOLVER_VERIFIED === 0) && (dispute.state & CHALLENGER_VERIFIED === 0)) {
          debug('Challenger: SUBMITTING FOR l=' +
          challengerComputationPath.left.hash + ' r=' + challengerComputationPath.right.hash);
          try {
            await submitProofHelper(verifier, event.disputeId, code, challengerComputationPath);
          } catch (err) {
            debug(err);
          }
        }

        // refresh again
        dispute = await verifier.disputes(event.disputeId);

        let winner = 'challenger';
        if ((dispute.state & SOLVER_VERIFIED) !== 0) {
          winner = 'solver';
        }
        debug('winner=' + winner);

        assert.equal(winner, expectedWinner, 'winner should match fixture');
        break;
      }

      if (!solverComputationPath.isLeaf) {
        let solverPath = dispute.solverPath;
        let nextPath = solverMerkle.getNode(solverPath);

        if (!nextPath) {
          debug('solver: submission already made by another party');
          solverComputationPath = solverMerkle.getPair(dispute.solver.left, dispute.solver.right);
          continue;
        }

        if (solverComputationPath.left.hash === solverPath) {
          debug('solver goes left from ' +
            solverComputationPath.hash.substring(2, 6) + ' to ' +
            solverComputationPath.left.hash.substring(2, 6)
          );
        } else if (solverComputationPath.right.hash === solverPath) {
          debug('solver goes right from ' +
            solverComputationPath.hash.substring(2, 6) + ' to ' +
            solverComputationPath.right.hash.substring(2, 6)
          );
        }

        solverComputationPath = nextPath;

        const witnessPath = computeWitnessPath(dispute, solverMerkle);

        debug('Solver respond\n',
          `\tleft = ${solverComputationPath.left.hash}`,
          `\tright = ${solverComputationPath.right.hash}`,
          `\twitnessPath = l=${witnessPath.left} r=${witnessPath.right}`);
        tx = await verifier.respond(
          event.disputeId,
          {
            left: solverComputationPath.left.hash,
            right: solverComputationPath.right.hash,
          },
          witnessPath,
          txOverrides
        );
        await tx.wait();
        dispute = await verifier.disputes(event.disputeId);
      }

      if (!challengerComputationPath.isLeaf) {
        let challengerPath = dispute.challengerPath;
        let nextPath = challengerMerkle.getNode(challengerPath);

        if (!nextPath) {
          debug('challenger submission already made by another party');
          challengerComputationPath =
            challengerMerkle.getPair(dispute.challenger.left, dispute.challenger.right);
          continue;
        }

        if (challengerComputationPath.left.hash === challengerPath) {
          debug('challenger goes left from ' +
            challengerComputationPath.hash.substring(2, 6) + ' to ' +
            challengerComputationPath.left.hash.substring(2, 6)
          );
        } else if (challengerComputationPath.right.hash === challengerPath) {
          debug('challenger goes right from ' +
            challengerComputationPath.hash.substring(2, 6) + ' to ' +
            challengerComputationPath.right.hash.substring(2, 6)
          );
        }

        challengerComputationPath = nextPath;

        const witnessPath = computeWitnessPath(dispute, challengerMerkle);

        debug('Challenger respond\n',
          `\tleft = ${challengerComputationPath.left.hash}`,
          `\tright = ${challengerComputationPath.right.hash}`,
          `\twitnessPath = l=${witnessPath.left} r=${witnessPath.right}`);
        tx = await verifier.respond(
          event.disputeId,
          {
            left: challengerComputationPath.left.hash,
            right: challengerComputationPath.right.hash,
          },
          witnessPath,
          txOverrides
        );
        await tx.wait();
      }
    }
  } catch (e) {
    if (expectedError) {
      assert.equal(e.message, expectedError);
      return;
    }

    // refresh again
    const dispute = await verifier.disputes(disputeId);

    let winner = 'challenger';
    if ((dispute.state & SOLVER_VERIFIED) !== 0) {
      winner = 'solver';
    }
    debug('winner=' + winner);

    assert.equal(winner, expectedWinner, 'winner should match fixture');
  }
}

contract('Verifier', function () {
  let enforcer;
  let verifier;

  before(async () => {
    const challengePeriod = 1000;
    const timeoutDuration = 10;
    const bondAmount = 1;
    const maxExecutionDepth = 10;

    verifier = await deployContract(Verifier, timeoutDuration);
    enforcer = await deployContract(Enforcer, verifier.address, challengePeriod, bondAmount, maxExecutionDepth);

    let tx = await verifier.setEnforcer(enforcer.address);

    await tx.wait();
  });

  disputeFixtures(
    async (code, callData, solverMerkle, challengerMerkle, expectedWinner) => {
      const codeHash = Merkelizer.codeHash(code.join(''));

      await disputeGame(
        enforcer,
        verifier,
        codeHash,
        code,
        callData,
        solverMerkle,
        challengerMerkle,
        expectedWinner
      );
    }
  );

  describe('submitProof', async () => {
    it('not allow preemptive submission of proof', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345678';

      let tx = await enforcer.register(
        codeHash,
        callData,
        ZERO_HASH,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      tx = await enforcer.dispute(
        codeHash,
        callData,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      let proofs = {
        stackHash: ZERO_HASH,
        memHash: ZERO_HASH,
        dataHash: ZERO_HASH,
      };

      // should not accept submitProof
      await assertRevert(verifier.submitProof(
        disputeId,
        proofs,
        {
          data: '0x12345678',
          stack: [],
          mem: [],
          returnData: '0x',
          pc: 0,
          gasRemaining: GAS_LIMIT,
          stackSize: 0,
          memSize: 0,
          customEnvironmentHash: ZERO_HASH,
          code: Merkelizer.emptyRawCode(),
          codeLength: 1,
          codeFragLength: 0,
        },
        txOverrides
      ));
    });
  });

  describe('claimTimeout', async () => {
    it('non-existent dispute, cannot claim', async () => {
      // TODO geth require to specific gasLimit although the transaction only cost ~50k
      await assertRevert(
        verifier.claimTimeout(toBytes32('NotExist'), { gasLimit: GAS_LIMIT }),
        'dispute not exist'
      );
    });

    it('not yet timeout, cannot claim', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345679';

      let tx = await enforcer.register(
        codeHash,
        callData,
        ZERO_HASH,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      tx = await enforcer.dispute(
        codeHash,
        callData,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      // should not accept submitProof
      await assertRevert(verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT }), 'not timed out yet');
    });

    it('nobody submits anything, solver wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345680';

      let tx = await enforcer.register(
        codeHash,
        callData,
        ZERO_HASH,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      tx = await enforcer.dispute(
        codeHash,
        callData,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      await onchainWait(10);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?
      const SOLVER_VERIFIED = 1 << 2;

      assert.notEqual(dispute.state & SOLVER_VERIFIED, 0, 'solver should win');

      // cannot call claimTimeout a second time
      await assertRevert(verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT }), 'already notified enforcer');
    });

    it('1 round - solver submitted, solver wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '01',
        OP.RETURN,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345680';

      let solverHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);

      let tx = await enforcer.register(
        codeHash,
        callData,
        solverHash,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      tx = await enforcer.dispute(
        codeHash,
        callData,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      // solver respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await onchainWait(10);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?
      const SOLVER_VERIFIED = 1 << 2;

      assert.notEqual(dispute.state & SOLVER_VERIFIED, 0, 'solver should win');
    });

    it('1 round - challenger submitted, challenger wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '02',
        OP.RETURN,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345680';

      let tx = await enforcer.register(
        codeHash,
        callData,
        ZERO_HASH,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let challengerHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);
      tx = await enforcer.dispute(
        codeHash,
        callData,
        challengerHash,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let disputeId = tx.events[0].args.disputeId;

      // challenger respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await onchainWait(10);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?

      assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
    });

    it('1 round - both submitted, waiting proof, challenger wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.REVERT,
      ];
      const codeHash = Merkelizer.codeHash(code.join(''));
      const callData = '0x12345680';

      let solverHash = Merkelizer.hash(ONE_HASH, TWO_HASH);
      let tx = await enforcer.register(
        codeHash,
        callData,
        solverHash,
        1,
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let challengerHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);
      tx = await enforcer.dispute(
        codeHash,
        callData,
        challengerHash,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let disputeId = tx.events[0].args.disputeId;

      // solver respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: TWO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      // challenger respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await onchainWait(10);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?

      assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
    });
  });

  it('computationPath.left is zero, challenger should win', async () => {
    const code = [
      OP.PUSH1, '20',
      OP.PUSH1, '00',
      OP.RETURN,
    ];
    const codeHash = Merkelizer.codeHash(code.join(''));
    const callData = '0x12345679';

    let tx = await enforcer.register(
      codeHash,
      callData,
      Merkelizer.hash(ZERO_HASH, ONE_HASH),
      1,
      ZERO_HASH,
      { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    tx = await tx.wait();
    tx = await enforcer.dispute(
      codeHash,
      callData,
      Merkelizer.hash(ONE_HASH, ZERO_HASH),
      { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    tx = await tx.wait();
    let disputeId = tx.events[0].args.disputeId;

    // challenger
    tx = await verifier.respond(
      disputeId,
      {
        left: ONE_HASH,
        right: ZERO_HASH,
      },
      ZERO_WITNESS_PATH,
      { gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    // solver
    tx = await verifier.respond(
      disputeId,
      {
        left: ZERO_HASH,
        right: ONE_HASH,
      },
      ZERO_WITNESS_PATH,
      { gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    const dispute = await verifier.disputes(disputeId);

    assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
  });
});
