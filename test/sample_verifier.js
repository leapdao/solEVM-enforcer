import chai from 'chai';
import { deployContract, wallets } from './utils.js';
import { ethers } from 'ethers';

const Verifier = artifacts.require("./SampleVerifier.sol");
const Enforcer = artifacts.require("./Enforcer");

const should = chai
  .use(require('chai-as-promised'))
  .should();

let verifier;
let enforcer;

contract('SampleVerifier', () => {
  before(async () => {
    verifier = await deployContract(Verifier, 100);
    enforcer = await deployContract(Enforcer, verifier.address, 0, 100);
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
    await verifier.initGame(
      execId,
      ethers.utils.formatBytes32String("execHashsolver"), 10,
      ethers.utils.formatBytes32String("execHashChallenger"), 10,
      wallets[0].address,
      wallets[1].address
    );
    let dispute = await verifier.disputes(execId);
    assert.equal(dispute[0], wallets[0].address, "solver address incorrect");
    assert.equal(dispute[1], wallets[1].address, "challenger address incorrect");
    assert.equal(dispute[7], 0, "state not Initialised");
    assert.equal(dispute[8], 2, "result not Undecided");
  })

  it("should have correct game flow", async () => {
    // fake enforcer
    await verifier.setEnforcer(wallets[0].address);
    let execId = ethers.utils.formatBytes32String("2");
    let sampleState = ethers.utils.formatBytes32String("state");
    let sampleProof = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [sampleState, sampleState]
    );

    await verifier.initGame(
      execId,
      sampleProof, 2,
      sampleState, 2,
      wallets[0].address,
      wallets[1].address
    );

    await verifier.solverProofs(execId, [sampleState], sampleState, [sampleState], sampleState);
    const disputeState = (await verifier.disputes(execId))[7];
    assert.equal(await disputeState, 1, "state not SolverTurn");
  });

  it("should end dispute when solver submit incorrect initial proofs", async () => {
    await veriifer.setEnforcer(wallets[0].address);
  });

  it("should allow anyone to trigger timeout of a dispute correctly", async () => {

  });
});

