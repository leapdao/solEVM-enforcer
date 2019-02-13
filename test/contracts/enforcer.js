import { deployContract, txOverrides } from './../helpers/utils';

const Enforcer = artifacts.require('./Enforcer.sol');
const Verifier = artifacts.require('./Verifier.sol');

contract('Enforcer', () => {
  const callData = '0xc0ffee';
  const endHash = '0x712bc4532b751c4417b44cf11e2377778433ff720264dc8a47cb1da69d371433';
  const otherEndHash = '0x641db1239a480d87bdb76fc045d5f6a68ad1cbf9b93e3b2c92ea638cff6c2add';
  const executionLength = 100;

  it('should allow to register and challenge execution', async () => {
    const bondAmount = 999;
    const challengePeriod = 3;
    const timeoutDuration = 0;
    const verifier = await deployContract(Verifier, timeoutDuration);
    const enforcer = await deployContract(Enforcer, verifier.address, challengePeriod, bondAmount);

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    // register execution and check state
    tx = await enforcer.register(
      enforcer.address, callData, endHash, executionLength,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );

    tx = await tx.wait();

    // start dispute
    tx = await enforcer.dispute(
      enforcer.address, callData, otherEndHash,
      { value: bondAmount, gasLimit: 0xfffffffffffff }
    );
    tx = await tx.wait();

    const disputeId = tx.events[0].args.disputeId;
    const bondBefore = (await enforcer.bonds(enforcer.signer.address)).toNumber();

    // solver wins if nothing happened until claimTimeout
    tx = await verifier.claimTimeout(disputeId, txOverrides);
    await tx.wait();

    // check that the challenger bond got slashed (solver & challenger are both the same in this test)
    const bondAfter = (await enforcer.bonds(enforcer.signer.address)).toNumber();
    assert.equal(bondAfter, bondBefore - bondAmount, 'bondAfter');
  });
});
