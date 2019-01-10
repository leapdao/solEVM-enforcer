import { deployContract, wallets, txOverrides } from './utils';

const Enforcer = artifacts.require('./Enforcer.sol');
const VerifierMock = artifacts.require('./mocks/VerifierMock.sol');
const CallbackMock = artifacts.require('./mocks/CallbackMock.sol');

const code = '0xaabb';
const callData = '0xbb';
const endHash = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const executionLength = 1;
const otherEndHash = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const otherExecutionLength = 1;

contract('Enforcer', () => {
  function getDisputeId (events) {
    return events[events.length - 1].topics[1];
  }

  function getExecutionId (events) {
    return events[events.length - 1].topics[1];
  }

  it('should allow to register and finalize execution', async () => {
    const contract = await deployContract(CallbackMock);
    // create enforcer
    const enforcer = await deployContract(Enforcer, wallets[0].address, 0, 0);

    // register execution and check state
    let tx = await contract.register(enforcer.address, code, callData, endHash, executionLength, txOverrides);
    const reg = await tx.wait();
    const executionId = getExecutionId(reg.events);
    const execs = await enforcer.executions(executionId);
    assert.equal(execs[3], contract.address); // execs[3] is solver address of execution struct

    // finalize execution
    tx = await enforcer.finalize(executionId, txOverrides);
    const rsp = await tx.wait();
    // check that contract has been called with finalize
    assert.equal(getExecutionId(rsp.events), executionId);
  });

  it('should allow to register and finalize execution with bond', async () => {
    const bondAmount = 999;
    const contract = await deployContract(CallbackMock);
    // create enforcer
    const enforcer = await deployContract(Enforcer, wallets[0].address, 0, bondAmount);

    // register execution and check state
    let tx = await contract.register(
      enforcer.address, code, callData, endHash, executionLength,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );

    const reg = await tx.wait();
    const executionId = getExecutionId(reg.events);

    // finalize execution
    tx = await enforcer.finalize(executionId, txOverrides);
    await tx.wait();
    // check that contract has a balance
    const bal = await contract.provider.getBalance(contract.address);
    assert.equal(bal, bondAmount);
  });

  it('should allow to register and attempt challenge', async () => {
    const contract = await deployContract(CallbackMock);
    const verifier = await deployContract(VerifierMock, 0);
    // create enforcer
    const enforcer = await deployContract(Enforcer, verifier.address, 3, 0);

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await contract.register(enforcer.address, code, callData, endHash, executionLength, txOverrides);
    const reg = await tx.wait();
    const executionId = getExecutionId(reg.events);

    // start dispute
    tx = await enforcer.dispute(
      executionId, otherEndHash, otherExecutionLength,
      txOverrides
    );
    const disp = await tx.wait();
    const disputeId = getDisputeId(disp.events);

    // have solver win the dispute
    tx = await verifier.result(disputeId, true, txOverrides); // true == solver wins
    await tx.wait();

    // finalize execution
    tx = await enforcer.finalize(executionId, txOverrides);
    const rsp = await tx.wait();
    // check that contract has been called with finalize
    assert.equal(getExecutionId(rsp.events), executionId);
  });

  it('should allow to register and challenge execution', async () => {
    const contract = await deployContract(CallbackMock);
    const verifier = await deployContract(VerifierMock, 0);
    // create enforcer
    const bondAmount = 999;
    const enforcer = await deployContract(Enforcer, verifier.address, 3, bondAmount);

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await contract.register(
      enforcer.address, code, callData, endHash, executionLength,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );

    const reg = await tx.wait();
    const executionId = getExecutionId(reg.events);

    // start dispute
    tx = await enforcer.dispute(
      executionId, otherEndHash, otherExecutionLength,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );
    const disp = await tx.wait();
    const disputeId = getDisputeId(disp.events);

    // have challenge win the dispute
    tx = await verifier.result(disputeId, false, txOverrides); // false == challenger wins
    await tx.wait();

    // check execution deleted
    const execs = await enforcer.executions(executionId);
    assert.equal(execs[0], 0); // execs[0] is startBlock of execution
    // check that contract has a balance
    const bal = await contract.provider.getBalance(enforcer.address);
    assert.equal(bal, bondAmount);
  });
});
