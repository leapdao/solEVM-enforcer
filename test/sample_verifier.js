import assertRevert from './helpers/assertRevert.js';
import chai from 'chai';
import { deployContract, wallets } from './utils.js';
import { ethers } from 'ethers';

const Verifier = artifacts.require("./SampleVerifierMock");
// const Verifier = artifacts.require("./SampleVerifier");
const Enforcer = artifacts.require("./Enforcer");

const should = chai
  .use(require('chai-as-promised'))
  .should();

let verifier;
let enforcer;

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
      result: dispute[9]
    }
  }

  let getDisputeIdFromEvent = async (tx) => {
    return (await tx.wait()).events[0].topics[1];
  }

  before(async () => {
    verifier = await deployContract(Verifier, 100);
    enforcer = await deployContract(Enforcer, verifier.address, 100, 100);
    await verifier.setEnforcer(enforcer.address);
  });

  it("should have timeout set", async () => {
    assert.equal(await verifier.timeoutDuration(), 100, "timeout not set");
  });

  it("have enforcer's address set", async () => {
    assert.equal(await verifier.enforcer(), enforcer.address, "enforcer not set");
  });

  it("should allow enforcer to initGame", async () => {
    // fake enforcer
    await verifier.setEnforcer(wallets[0].address);
    let execId = ethers.utils.formatBytes32String("1");
    let tx = await verifier.initGame(
      execId,
      ethers.utils.formatBytes32String("execHashsolver"), 10,
      ethers.utils.formatBytes32String("execHashChallenger"), 10,
      wallets[0].address,
      wallets[1].address
    );
    const disputeId = await getDisputeIdFromEvent(tx);
    console.log('DisputeId', disputeId);
    let dispute = await parseDispute(disputeId);
    assert.equal(dispute.solver, wallets[0].address, "solver address incorrect");
    assert.equal(dispute.challenger, wallets[1].address, "challenger address incorrect");
    assert.equal(dispute.state, 0, "state not Initialised");
    assert.equal(dispute.result, 2, "result not Undecided");
  });

  it("should have correct game flow", async () => {
    let execId = ethers.utils.formatBytes32String("2");
    let sampleState = ethers.utils.formatBytes32String("state");
    let sampleProof = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [sampleState, sampleState]
    );

    let tx = await verifier.initGame(
      execId,
      sampleProof, 2,
      sampleState, 2,
      wallets[0].address,
      wallets[1].address
    );
    let disputeId = await getDisputeIdFromEvent(tx);
    let dispute = await parseDispute(disputeId);
    await verifier.solverProofs(disputeId, [sampleState], sampleState, [sampleState], sampleState);
    dispute = await parseDispute(disputeId);
    assert.equal(await dispute.state, 1, "state not SolverTurn");
  });

  it("should end dispute when solver submit incorrect initial proofs", async () => {
  });

  it("should allow modification of timeout in mock", async () => {
    let execId = ethers.utils.formatBytes32String("4");
    let sampleState = ethers.utils.formatBytes32String("state");
    let sampleProof = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [sampleState, sampleState]
    );

    let tx = await verifier.initGame(
      execId,
      sampleProof, 2,
      sampleState, 2,
      wallets[0].address,
      wallets[1].address
    );
    const disputeId = await getDisputeIdFromEvent(tx);
    await verifier.setTimeout(
      disputeId,
      1 // already timed out
    );
    let dispute = await parseDispute(disputeId);
    assert(dispute.timeout, 1, "timeout not set");
  });

  it("should allow anyone to trigger timeout of a dispute correctly", async () => {
    let execId = ethers.utils.formatBytes32String("5");
    let sampleState = ethers.utils.formatBytes32String("state");
    let sampleProof = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [sampleState, sampleState]
    );

    let tx = await verifier.initGame(
      execId,
      sampleProof, 2,
      sampleState, 2,
      wallets[0].address,
      wallets[1].address
    );
    const disputeId = await getDisputeIdFromEvent(tx);

    assertRevert(verifier.claimTimeout(disputeId));

    await verifier.setTimeout(
      disputeId,
      1 // already timed out
    );

    await verifier.claimTimeout(disputeId);
    let dispute = await parseDispute(disputeId);
    assert(dispute.state, 4, "state not Ended");
    assert(dispute.result, 1, "result not ChallengerCorrect");
  });
});

