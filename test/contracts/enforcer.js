const ethers = require('ethers');
const assert = require('assert');

const { onchainWait, toBytes32, wallets, deployContract, txOverrides } = require('./../helpers/utils');
const assertRevert = require('./../helpers/assertRevert');

const Enforcer = require('./../../build/contracts/Enforcer.json');
const Verifier = require('./../../build/contracts/Verifier.json');
const VerifierMock = require('./../../build/contracts/VerifierMock.json');

const GAS_LIMIT = require('./../../utils/constants').GAS_LIMIT;

describe('Enforcer', () => {
  const solverPathRoot = '0x712bc4532b751c4417b44cf11e2377778433ff720264dc8a47cb1da69d371433';
  const challengerPathRoot = '0x641db1239a480d87bdb76fc045d5f6a68ad1cbf9b93e3b2c92ea638cff6c2add';
  const result = '0x0000000000000000000000000000000000000000000000000000000000001111';
  const taskPeriod = 100000000;
  const challengePeriod = 30;
  const timeoutDuration = 2;
  const executionDepth = 10;
  const resultProof = new Array(executionDepth).fill(solverPathRoot);
  const maxExecutionDepth = 10;
  const bondAmount = 999;
  const params = {
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

  let enforcer;
  let verifier;
  let verifierMock;
  let solver = wallets[0];
  let challenger = wallets[1];
  let taskHash;

  before('Prepare contracts', async () => {
    verifier = await deployContract(Verifier, timeoutDuration);
    enforcer = await deployContract(
      Enforcer, verifier.address, taskPeriod, challengePeriod, bondAmount, maxExecutionDepth
    );

    let tx = await verifier.setEnforcer(enforcer.address);
    await tx.wait();

    verifierMock = await deployContract(VerifierMock, timeoutDuration);

    tx = await enforcer.request(params, '0x');
    tx = await tx.wait();
    taskHash = tx.events[0].args.taskHash;
  });

  it('should allow to register and challenge execution', async () => {
    // register execution and check state
    let tx = await enforcer.register(
      taskHash, solverPathRoot, resultProof, result,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    tx = await tx.wait();

    // start dispute
    tx = await enforcer.dispute(
      solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    const disputeId = tx.events[0].args.disputeId;
    const bondBefore = (await enforcer.bonds(enforcer.signer.address)).toNumber();

    await onchainWait(timeoutDuration);

    // solver wins if nothing happened until claimTimeout
    tx = await verifier.claimTimeout(disputeId, txOverrides);
    await tx.wait();

    // check that the challenger bond got slashed (solver & challenger are both the same in this test)
    const bondAfter = (await enforcer.bonds(enforcer.signer.address)).toNumber();
    assert.equal(bondAfter, bondBefore - bondAmount, 'bondAfter');
  });

  // change to VerifierMock for further testing
  it('should have correct information', async () => {
    enforcer = await deployContract(
      Enforcer, verifierMock.address, taskPeriod, challengePeriod, bondAmount, maxExecutionDepth
    );
    let tx = await verifierMock.setEnforcer(enforcer.address);
    await tx.wait();

    assert.equal(await enforcer.verifier(), verifierMock.address, 'verifier address not match');
    assert.equal(await enforcer.challengePeriod(), challengePeriod, 'challenge period not match');
    assert.equal(await enforcer.bondAmount(), bondAmount, 'bond amount not match');

    tx = await enforcer.request(params, '0x');
    tx = await tx.wait();
    taskHash = tx.events[0].args.taskHash;
  });

  // register
  it('not allow registration without bond', async () => {
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof, result,
      { value: 0, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'Bond is required');
  });

  it('not allow registration of oversized execution', async () => {
    let tx = enforcer.register(
      taskHash, solverPathRoot, new Array(maxExecutionDepth + 1).fill(solverPathRoot), result,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'Execution too long');
  });

  it('allow registration of new execution', async () => {
    const solverBond = await enforcer.bonds(solver.address);
    let tx = await enforcer.register(
      taskHash, solverPathRoot, resultProof, result,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();
    const event = tx.events[0].args;
    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, solverPathRoot]);

    assert.equal(event.solverPathRoot, solverPathRoot, 'solverPathRoot does not match');
    assert.equal(event.executionDepth, executionDepth, 'executionDepth does not match');
    assert.equal(event.result, result, 'result does not match');

    assert.deepEqual(await enforcer.bonds(solver.address), solverBond.add(bondAmount), 'bond amount not update');

    const execution = await enforcer.executions(executionId);

    assert.ok(execution.startBlock.gt(0), 'start block not set');
    assert.equal(execution.solverPathRoot, solverPathRoot, 'solverPathRoot not match');
    assert.equal(execution.executionDepth, executionDepth, 'execution length not match');
    assert.equal(execution.solver, solver.address, 'solver address not match');
  });

  it('not allow registration of the same execution', async () => {
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof, result,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await assertRevert(tx, 'Execution already registered');
  });

  // dispute
  it('not allow dispute with nonexistent execution', async () => {
    let tx = enforcer.dispute(
      solverPathRoot.replace('71', '00'), challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'Execution does not exist');
  });

  it('not allow dispute without bond', async () => {
    let tx = enforcer.dispute(
      solverPathRoot, challengerPathRoot, params,
      { value: 0, gasLimit: GAS_LIMIT }
    );
    await assertRevert(tx, 'Bond amount is required');
  });

  it('not allow dispute when there is not enough time', async () => {
    await onchainWait(challengePeriod - (executionDepth + 1) * timeoutDuration);

    let tx = enforcer.dispute(
      solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await assertRevert(tx, 'Execution is out of challenge period');
  });

  it('allow dispute with valid execution', async () => {
    const _solverPathRoot = solverPathRoot.replace('bc', '11');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, resultProof, result.replace('00', '66'),
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    const challengerBond = await enforcer.bonds(challenger.address);

    tx = await enforcer.connect(challenger).dispute(
      _solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);

    assert.equal(tx.events[0].args.executionId, executionId, 'dispute incorrect execution');
    assert.deepEqual(
      await enforcer.bonds(challenger.address),
      challengerBond.add(bondAmount),
      'bond amount not update'
    );
  });

  // result
  it('not allow submit not by verifier', async () => {
    let tx = enforcer.connect(challenger).result(
      toBytes32('invalid', 64),
      true,
      challenger.address,
      { gasLimit: GAS_LIMIT });
    await assertRevert(tx);
  });

  it('not allow submit result of nonexistent execution', async () => {
    let tx = verifierMock.submitResult(
      toBytes32('invalid', 64),
      true,
      challenger.address,
      { gasLimit: GAS_LIMIT });
    await assertRevert(tx, 'Execution does not exist');
  });

  it('not allow submit result of execution after challenge period', async () => {
    const _solverPathRoot = solverPathRoot.replace('11', '22');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, resultProof, result.replace('00', '77'),
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();
    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);

    await onchainWait(challengePeriod);

    tx = verifierMock.submitResult(executionId, false, challenger.address, { gasLimit: GAS_LIMIT });
    await assertRevert(tx, 'Execution is out of challenge period');
  }).timeout(10000);

  it('allow submit result of valid execution and slash solver', async () => {
    const _solverPathRoot = solverPathRoot.replace('11', '55');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, resultProof, result.replace('00', '88'),
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);
    const solverBond = await enforcer.bonds(solver.address);

    tx = await verifierMock.submitResult(executionId, false, challenger.address, { gasLimit: GAS_LIMIT });
    await tx.wait();

    assert.deepEqual(await enforcer.bonds(solver.address), solverBond.sub(bondAmount), 'solver not slashed');
    const execution = await enforcer.executions(executionId);
    assert.equal(execution.startBlock, 0, 'execution not deleted');
  });

  it('allow submit result of valid execution and slash challenger', async () => {
    const _solverPathRoot = solverPathRoot.replace('11', 'aa');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, resultProof, result.replace('00', '99'),
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    tx = await enforcer.connect(challenger).dispute(
      _solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);
    const challengerBond = await enforcer.bonds(challenger.address);

    tx = await verifierMock.submitResult(executionId, true, challenger.address, { gasLimit: GAS_LIMIT });
    await tx.wait();
    assert.deepEqual(
      await enforcer.bonds(challenger.address),
      challengerBond.sub(bondAmount),
      'challenger not slashed');
  });

  it('Enforcer.request / Enforcer.getStatus()', async () => {
    const evmParams = Object.assign(params, { txGasLimit: 0xfafafafa });

    let tx = await enforcer.request(evmParams, '0x');
    tx = await tx.wait();
    taskHash = tx.events[0].args.taskHash;

    // should not work the second time 😊
    tx = enforcer.request(evmParams, '0x');
    await assertRevert(tx, 'Parameters already registered');

    const _solverPathRoot = solverPathRoot.replace('11', 'ac');
    const resultBytes = result.replace('00', '99');

    tx = await enforcer.register(
      taskHash, _solverPathRoot, resultProof, resultBytes,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    // should not work the second time 😊
    tx = enforcer.register(
      taskHash, _solverPathRoot, resultProof, resultBytes,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await assertRevert(tx, 'Execution already registered');

    // XXX: ethers returns not the `Task` struct -  wtf???
    const task = await enforcer.tasks(taskHash);
    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);
    let status = await enforcer.getStatus(taskHash);

    assert.equal(status[0].toString(), task.add(taskPeriod).toString(), 'taskPeriod');
    assert.deepEqual(status[1], [_solverPathRoot], 'pathRoots');
    assert.deepEqual(status[2], [ethers.utils.solidityKeccak256(['bytes'], [resultBytes])], 'resultHashes');

    tx = await enforcer.connect(challenger).dispute(
      _solverPathRoot, challengerPathRoot, evmParams,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();
    tx = await verifierMock.submitResult(executionId, false, challenger.address, { gasLimit: GAS_LIMIT });
    tx = await tx.wait();

    // should be empty now
    status = await enforcer.getStatus(taskHash);
    assert.deepEqual(status[1], [], 'pathRoots should be empty');
    assert.deepEqual(status[2], [], 'resultHashes should be empty');
  });
});
