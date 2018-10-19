import chai from 'chai';
const Enforcer = artifacts.require("./Enforcer.sol");
const VerifierMock = artifacts.require("./mocks/VerifierMock.sol");
const CallbackMock = artifacts.require("./mocks/CallbackMock.sol");

const should = chai
  .use(require('chai-as-promised'))
  .should();

contract('Enforcer', (accounts) => {

  it("should allow to register and finalize execution", async () => {
  	const contract = await CallbackMock.new();
  	// create enforcer
  	const enforcer = await Enforcer.new(accounts[0], 0, 0);

  	// register execution and check state
  	const reg = await contract.register(enforcer.address, '0xaabb', '0xbb', '0xcc');
  	const executionId = reg.receipt.logs[0].topics[1];
  	const execs = await enforcer.executions(executionId);
  	assert.equal(execs[2], contract.address); // execs[2] is solver address of execution struct

  	// finalize execution
  	const rsp = await enforcer.finalize(executionId);
  	// check that contract has been called with finalize
  	assert.equal(rsp.receipt.logs[0].topics[1], executionId);
  });

  it("should allow to register and finalize execution with bond", async () => {
  	const bondAmount = 999;
  	const contract = await CallbackMock.new();
  	// create enforcer
  	const enforcer = await Enforcer.new(accounts[0], 0, bondAmount);

  	// register execution and check state
  	const reg = await contract.register(enforcer.address,
  		'0xaabb', '0xbb', '0xcc', {value: bondAmount});
  	const executionId = reg.receipt.logs[0].topics[1];

  	// finalize execution
  	const rsp = await enforcer.finalize(executionId);
  	// check that contract has a balance
  	const bal = await web3.eth.getBalance(contract.address);
  	assert.equal(bal, bondAmount);
  });

  it("should allow to register and attempt challenge", async () => {
  	const contract = await CallbackMock.new();
  	const verifier = await VerifierMock.new(0);
  	// create enforcer
  	const enforcer = await Enforcer.new(verifier.address, 3, 0);
  	await verifier.setEnforcer(enforcer.address);

  	// register execution and check state
  	const reg = await contract.register(enforcer.address, '0xaabb', '0xbb', '0xcc');
  	const executionId = reg.receipt.logs[0].topics[1];

  	// start dispute
  	const disp = await enforcer.dispute(executionId, '0xdd', {from: accounts[1]});
  	const disputeId = disp.receipt.logs[0].topics[1];

  	// have solver win the dispute
  	await verifier.result(disputeId, true); // true == solver wins

  	// finalize execution
  	const rsp = await enforcer.finalize(executionId);
  	// check that contract has been called with finalize
  	assert.equal(rsp.receipt.logs[0].topics[1], executionId);
  });

  it("should allow to register and challenge execution", async () => {
  	const contract = await CallbackMock.new();
  	const verifier = await VerifierMock.new(0);
  	// create enforcer
  	const bondAmount = 999;
  	const enforcer = await Enforcer.new(verifier.address, 3, bondAmount);
  	await verifier.setEnforcer(enforcer.address);

  	// register execution and check state
  	const reg = await contract.register(enforcer.address,
  		'0xaabb', '0xbb', '0xcc', {value: bondAmount});
  	const executionId = reg.receipt.logs[0].topics[1];

  	// start dispute
  	const disp = await enforcer.dispute(executionId, '0xdd', {value: bondAmount, from: accounts[1]});
  	const disputeId = disp.receipt.logs[0].topics[1];

  	// have challenge win the dispute
  	await verifier.result(disputeId, false); // false == challenger wins

  	// check execution deleted
  	const execs = await enforcer.executions(executionId);
  	assert.equal(execs[0], 0); // execs[0] is startBlock of execution
  	// check that contract has a balance
  	const bal = await web3.eth.getBalance(enforcer.address);
  	assert.equal(bal, bondAmount);
  });

});
