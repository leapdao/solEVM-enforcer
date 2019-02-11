import { deployContract, txOverrides } from './../helpers/utils';

const Enforcer = artifacts.require('./Enforcer.sol');
const VerifierMock = artifacts.require('./mocks/VerifierMock.sol');

contract('Enforcer', () => {
  function getDisputeId (events) {
    return events[events.length - 1].topics[1];
  }

  function getExecutionId (events) {
    return events[events.length - 1].topics[1];
  }

  const callData = '0xc0ffee';
  const endHash = '0x712bc4532b751c4417b44cf11e2377778433ff720264dc8a47cb1da69d371433';
  const otherEndHash = '0x641db1239a480d87bdb76fc045d5f6a68ad1cbf9b93e3b2c92ea638cff6c2add';
  const executionLength = 100;

  it('should allow to register and challenge execution', async () => {
    const bondAmount = 999;
    const verifier = await deployContract(VerifierMock);
    const enforcer = await deployContract(Enforcer, verifier.address, 3, bondAmount);

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await enforcer.register(
      enforcer.address, callData, endHash, executionLength,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );

    const reg = await tx.wait();
    const executionId = getExecutionId(reg.events);

    // start dispute
    tx = await enforcer.dispute(
      enforcer.address, callData, otherEndHash,
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
    const bal = await enforcer.provider.getBalance(enforcer.address);
    assert.equal(bal, bondAmount);
  });
});
