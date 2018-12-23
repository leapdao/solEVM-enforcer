import assertRevert from './helpers/assertRevert.js';
import chai from 'chai';
import { deployContract, wallets } from './utils.js';
import { ethers } from 'ethers';

const Verifier = artifacts.require('./SampleVerifierMock');
// const Verifier = artifacts.require('./SampleVerifier');
const Enforcer = artifacts.require('./EnforcerMock');

const should = chai
  .use(require('chai-as-promised'))
  .should();

const DisputeState = {
  Initialised: 0,
  SolverTurn: 1,
  ChallengerTurn: 2,
  FoundDiff: 3,
  Ended: 4,
};

let verifier;
let enforcer;

let sampleState = ethers.utils.formatBytes32String('state');
let sampleState2 = ethers.utils.formatBytes32String('state2');
let sampleProof = ethers.utils.solidityKeccak256(
  ['bytes32', 'bytes32'],
  [sampleState, sampleState]
);

let sampleProof2 = ethers.utils.solidityKeccak256(
  ['bytes32', 'bytes32'],
  [sampleState2, sampleState2]
);

contract('SampleVerifierMock', () => {
  /*
   * Dispute:
   *  0: executionId
   *  1: solver
   *  2: challenger
   *  3: solverComputation
   *  4: challengerComputation
   *  5: left
   *  6: right
   *  7: timeout
   *  8: state
   *  9: result
   */
  let parseDispute = async (disputeId) => {
    let dispute = await verifier.disputes(disputeId);
    return {
      executionId: dispute[0],
      solver: dispute[1],
      challenger: dispute[2],
      timeout: dispute[7],
      state: dispute[8],
      result: dispute[9],
    };
  };

  let getDisputeIdFromEvent = async (tx) => {
    return (await tx.wait()).events[0].topics[1];
  };

  let generateExecId = () => {
    return ethers.utils.formatBytes32String(Date.now().toString());
  };

  before(async () => {
    verifier = await deployContract(Verifier, 100);
    enforcer = await deployContract(Enforcer);
    await verifier.setEnforcer(enforcer.address);
  });

  it('should have timeout set', async () => {
    assert.equal(await verifier.timeoutDuration(), 100, 'timeout not set');
  });

  it('have enforcer address set', async () => {
    assert.equal(await verifier.enforcer(), enforcer.address, 'enforcer not set');
  });

  it('should allow enforcer to initGame', async () => {
    // fake enforcer
    await verifier.setEnforcer(wallets[0].address);
    let tx = await verifier.initGame(
      generateExecId(),
      ethers.utils.formatBytes32String('execHashsolver'), 10,
      ethers.utils.formatBytes32String('execHashChallenger'), 10,
      wallets[0].address,
      wallets[1].address
    );
    let disputeId = await getDisputeIdFromEvent(tx);
    let dispute = await parseDispute(disputeId);
    assert.equal(dispute.solver, wallets[0].address, 'solver address incorrect');
    assert.equal(dispute.challenger, wallets[1].address, 'challenger address incorrect');
    assert.equal(dispute.state, 0, 'state not Initialised');
    assert.equal(dispute.result, 2, 'result not Undecided');
  });

  it('should have correct game flow', async () => {
    let tx = await verifier.initGame(
      generateExecId(),
      sampleProof, 2,
      sampleProof2, 2,
      wallets[0].address,
      wallets[1].address
    );
    let disputeId = await getDisputeIdFromEvent(tx);
    let dispute = await parseDispute(disputeId);
    await verifier.solverProofs(disputeId, [sampleState], sampleState, [sampleState], sampleState);
    dispute = await parseDispute(disputeId);
    assert.equal(dispute.state, 1, 'state not SolverTurn');
  });

  describe('When solver submit initial proofs', async () => {
    it('should end with incorrect initial proofs', async () => {
      let tx = await verifier.initGame(
        generateExecId(),
        sampleProof, 2,
        sampleProof2, 2,
        wallets[0].address,
        wallets[1].address
      );
      let disputeId = await getDisputeIdFromEvent(tx);
      // change enforcer to EnforcerMock address
      await verifier.setEnforcer(enforcer.address);
      await verifier.solverProofs(disputeId, [sampleState2], sampleState2, [sampleState], sampleState);
      await verifier.setEnforcer(wallets[0].address);
      let dispute = await parseDispute(disputeId);
      assert.equal(dispute.state, DisputeState.Ended, 'state not ended');
      assert.equal(dispute.result, 1, 'result not challenger correct');
    });

    it('should end with incorrect end proofs', async () => {
      let tx = await verifier.initGame(
        generateExecId(),
        sampleProof, 2,
        sampleProof2, 2,
        wallets[0].address,
        wallets[1].address
      );
      let disputeId = await getDisputeIdFromEvent(tx);
      // change enforcer to EnforcerMock address
      await verifier.setEnforcer(enforcer.address);
      await verifier.solverProofs(disputeId, [sampleState], sampleState, [sampleState2], sampleState2);
      await verifier.setEnforcer(wallets[0].address);
      let dispute = await parseDispute(disputeId);
      assert.equal(dispute.state, DisputeState.Ended, 'state not ended');
      assert.equal(dispute.result, 1, 'result not challenger correct');
    });
  });

  it('should allow modification of timeout in mock', async () => {
    let tx = await verifier.initGame(
      generateExecId(),
      sampleProof, 2,
      sampleProof2, 2,
      wallets[0].address,
      wallets[1].address
    );
    let disputeId = await getDisputeIdFromEvent(tx);
    await verifier.setTimeout(
      disputeId,
      1 // already timed out
    );
    let dispute = await parseDispute(disputeId);
    assert.equal(dispute.timeout, 1, 'timeout not set');
  });

  describe('when timed out', async () => {
    let solverLostStates = [
      DisputeState.Initialised,
      DisputeState.SolverTurn,
      DisputeState.FoundDiff,
    ];
    solverLostStates.forEach((state) => {
      it(`can trigger timeout and challenger is considered correct when state is ${state}`, async () => {
        let tx = await verifier.initGame(
          generateExecId(),
          sampleProof, 2,
          sampleProof2, 2,
          wallets[0].address,
          wallets[1].address
        );
        let disputeId = await getDisputeIdFromEvent(tx);

        assertRevert(verifier.claimTimeout(disputeId));

        await verifier.setState(disputeId, state);
        await verifier.setTimeout(
          disputeId,
          1 // already timed out
        );

        await verifier.setEnforcer(enforcer.address);
        await verifier.claimTimeout(disputeId);
        await verifier.setEnforcer(wallets[0].address);
        let dispute = await parseDispute(disputeId);
        assert.equal(dispute.state, DisputeState.Ended, 'state not Ended');
        assert.equal(dispute.result, 1, 'result not ChallengerCorrect');
      });
    });

    it('can trigger timeout and solver is considered correct when state is ChallengerTurn', async () => {
      let tx = await verifier.initGame(
        generateExecId(),
        sampleProof, 2,
        sampleProof2, 2,
        wallets[0].address,
        wallets[1].address
      );
      let disputeId = await getDisputeIdFromEvent(tx);

      assertRevert(verifier.claimTimeout(disputeId));

      await verifier.setState(disputeId, DisputeState.ChallengerTurn);
      await verifier.setTimeout(
        disputeId,
        1 // already timed out
      );

      await verifier.setEnforcer(enforcer.address);
      await verifier.claimTimeout(disputeId);
      await verifier.setEnforcer(wallets[0].address);
      let dispute = await parseDispute(disputeId);
      assert.equal(dispute.state, DisputeState.Ended, 'state not Ended');
      assert.equal(dispute.result, 0, 'state not SolverCorrect');
    });
  });
});

