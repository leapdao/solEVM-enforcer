import chai from 'chai';
import { deployContract, wallets, txOverrides } from './utils';

const Enforcer = artifacts.require("./Enforcer.sol");
const VerifierMock = artifacts.require("./mocks/VerifierMock.sol");
const CallbackMock = artifacts.require("./mocks/CallbackMock.sol");

const should = chai
  .use(require('chai-as-promised'))
  .should();

const code = '0xaabb';
const callData = '0xbb';
const endHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const otherEndHash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';

contract('Enforcer', () => {
  it("should allow to register and finalize execution", async () => {
    const contract = await deployContract(CallbackMock);
    // create enforcer
    const enforcer = await deployContract(Enforcer, wallets[0].address, 0, 0);

    // register execution and check state
    let tx = await contract.register(enforcer.address, code, callData, endHash, txOverrides);
    const reg = await tx.wait();
    const executionId = reg.events[0].topics[1];
    const execs = await enforcer.executions(executionId);
    assert.equal(execs[2], contract.address); // execs[2] is solver address of execution struct

    // finalize execution
    tx = await enforcer.finalize(executionId);
    const rsp = await tx.wait();
    // check that contract has been called with finalize
    assert.equal(rsp.events[0].topics[1], executionId);
  });

  it("should allow to register and finalize execution with bond", async () => {
    const bondAmount = 999;
    const contract = await deployContract(CallbackMock);
    // create enforcer
    const enforcer = await deployContract(Enforcer, wallets[0].address, 0, bondAmount);

    // register execution and check state
    let tx = await contract.register(
      enforcer.address, code, callData, endHash,
      { value: bondAmount, gasLimit: 0xffffff }
    );

    const reg = await tx.wait();
    const executionId = reg.events[0].topics[1];

    // finalize execution
    tx = await enforcer.finalize(executionId, txOverrides);
    const rsp = await tx.wait();
    // check that contract has a balance
    const bal = await contract.provider.getBalance(contract.address);
    assert.equal(bal, bondAmount);
  });

  it("should allow to register and attempt challenge", async () => {
    const contract = await deployContract(CallbackMock);
    const verifier = await deployContract(VerifierMock, 0);
    // create enforcer
    const enforcer = await deployContract(Enforcer, verifier.address, 3, 0);


    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await contract.register(enforcer.address, code, callData, endHash, txOverrides);
    const reg = await tx.wait();
    const executionId = reg.events[0].topics[1];

    // start dispute
    tx = await enforcer.dispute(
      executionId, otherEndHash,
      txOverrides
    );
    const disp = await tx.wait();
    const disputeId = disp.events[0].topics[1];

    // have solver win the dispute
    tx = await verifier.result(disputeId, true, txOverrides); // true == solver wins
    await tx.wait();

    // finalize execution
    tx = await enforcer.finalize(executionId);
    const rsp = await tx.wait();
    // check that contract has been called with finalize
    assert.equal(rsp.events[0].topics[1], executionId);
  });

  it("should allow to register and challenge execution", async () => {
    const contract = await deployContract(CallbackMock);
    const verifier = await deployContract(VerifierMock, 0);
    // create enforcer
    const bondAmount = 999;
    const enforcer = await deployContract(Enforcer, verifier.address, 3, bondAmount);

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await contract.register(
      enforcer.address, code, callData, endHash,
      { value: bondAmount, gasLimit: 0xffffff }
    );

    const reg = await tx.wait();
    const executionId = reg.events[0].topics[1];

    // start dispute
    tx = await enforcer.dispute(
      executionId, otherEndHash,
      { value: bondAmount, gasLimit: 0xffffff }
    );
    const disp = await tx.wait();
    const disputeId = disp.events[0].topics[1];

    // have challenge win the dispute
    tx = await verifier.result(disputeId, false); // false == challenger wins
    await tx.wait();

    // check execution deleted
    const execs = await enforcer.executions(executionId);
    assert.equal(execs[0], 0); // execs[0] is startBlock of execution
    // check that contract has a balance
    const bal = await contract.provider.getBalance(enforcer.address);
    assert.equal(bal, bondAmount);
  });

});
