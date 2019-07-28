'use strict';

const ethers = require('ethers');
const assert = require('assert');

const { sleep, toBytes32, wallets, deployContract, txOverrides } = require('./../helpers/utils');
const assertRevert = require('./../helpers/assertRevert');

const Enforcer = require('./../../build/contracts/Enforcer.json');
const Verifier = require('./../../build/contracts/Verifier.json');
const VerifierMock = require('./../../build/contracts/VerifierMock.json');

const { HydratedRuntime, Merkelizer, Constants } = require('./../../utils');
const GAS_LIMIT = Constants.GAS_LIMIT;

describe('Enforcer', () => {
  const code = [Constants.GAS].join('');
  const data = '0x';
  const challengerPathRoot = '0x641db1239a480d87bdb76fc045d5f6a68ad1cbf9b93e3b2c92ea638cff6c2add';
  const result = '0x0000000000000000000000000000000000000000000000000000000000001111';
  const taskPeriod = 100000000;
  const challengePeriod = 8;
  const timeoutDuration = 2;
  const executionDepth = 2;
  const maxExecutionDepth = 2;
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

  let dataCtr = 0;
  let enforcer;
  let verifier;
  let verifierMock;
  let solver = wallets[0];
  let challenger = wallets[1];
  let taskHash;
  let solverMerkle;
  let proof;
  let returnData;
  let solverPathRoot;
  let alreadyRegistered;

  async function newExecution (executionDepth) {
    const code = new Array(executionDepth).fill(Constants.GAS).join('');
    const data = '0x' + (dataCtr++).toString(16).padStart(32, '0');
    const executionSteps = await new HydratedRuntime().run({ code, data });
    const solverMerkle = new Merkelizer().run(executionSteps, code, data);
    const proof = solverMerkle.computeResultProof();

    return {
      solverPathRoot: solverMerkle.root.hash,
      resultProof: proof.resultProof,
      returnData: proof.returnData,
    };
  }

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

    const executionSteps = await new HydratedRuntime().run({ code, data });
    solverMerkle = new Merkelizer().run(executionSteps, code, data);
    solverPathRoot = solverMerkle.root.hash;
    proof = solverMerkle.computeResultProof();
  });

  it('should not allow to `setEnforcer` twice', async () => {
    const tx = verifier.setEnforcer(enforcer.address);
    await assertRevert(tx);
  });

  it('should allow to register and challenge execution', async () => {
    // register execution and check state
    let tx = await enforcer.register(
      taskHash, solverPathRoot, proof.resultProof, proof.returnData,
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

    await sleep(timeoutDuration);

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
      taskHash, solverPathRoot, proof.resultProof, proof.returnData,
      { value: 0, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'Bond is required');
  });

  it('not allow registration of oversized execution', async () => {
    const { solverPathRoot, resultProof, returnData } = await newExecution(maxExecutionDepth + 1);
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof, returnData,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'Execution too long');
  });

  it('allow registration of new execution', async () => {
    const solverBond = await enforcer.bonds(solver.address);
    const { solverPathRoot, resultProof, returnData } = await newExecution();
    alreadyRegistered = { solverPathRoot, resultProof, returnData };
    let tx = await enforcer.register(
      taskHash, solverPathRoot, resultProof, returnData,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();
    const event = tx.events[0].args;
    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, solverPathRoot]);

    assert.equal(event.solverPathRoot, solverPathRoot, 'solverPathRoot does not match');
    assert.equal(event.executionDepth, executionDepth, 'executionDepth does not match');
    assert.equal(event.result, returnData, 'result does not match');

    assert.deepEqual(await enforcer.bonds(solver.address), solverBond.add(bondAmount), 'bond amount not update');

    const execution = await enforcer.executions(executionId);

    assert.ok(execution.startTime.gt(0), 'start time not set');
    assert.equal(execution.solverPathRoot, solverPathRoot, 'solverPathRoot not match');
    assert.equal(execution.executionDepth, executionDepth, 'execution length not match');
    assert.equal(execution.solver, solver.address, 'solver address not match');
  });

  it('not allow registration of the same execution', async () => {
    const { solverPathRoot, resultProof, returnData } = alreadyRegistered;
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof, returnData,
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
    await sleep(challengePeriod - (executionDepth + 1) * timeoutDuration);

    const { solverPathRoot } = alreadyRegistered;
    let tx = enforcer.dispute(
      solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await assertRevert(tx, 'Execution is out of challenge period');
  });

  it('allow dispute with valid execution', async () => {
    const { solverPathRoot, resultProof, returnData } = await newExecution();

    let tx = await enforcer.register(
      taskHash, solverPathRoot, resultProof, returnData,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    const challengerBond = await enforcer.bonds(challenger.address);

    tx = await enforcer.connect(challenger).dispute(
      solverPathRoot, challengerPathRoot, params,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, solverPathRoot]);

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
    const { solverPathRoot, resultProof, returnData } = await newExecution();

    let tx = await enforcer.register(
      taskHash, solverPathRoot, resultProof, returnData,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();
    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, solverPathRoot]);

    await sleep(challengePeriod);

    tx = verifierMock.submitResult(executionId, false, challenger.address, { gasLimit: GAS_LIMIT });
    await assertRevert(tx, 'Execution is out of challenge period');
  }).timeout(10000);

  it('allow submit result of valid execution and slash solver', async () => {
    const _solverPathRoot = solverPathRoot.replace('11', '55');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, proof.resultProof, proof.returnData.replace('00', '88'),
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    const executionId = ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [taskHash, _solverPathRoot]);
    const solverBond = await enforcer.bonds(solver.address);

    tx = await verifierMock.submitResult(executionId, false, challenger.address, { gasLimit: GAS_LIMIT });
    await tx.wait();

    assert.deepEqual(await enforcer.bonds(solver.address), solverBond.sub(bondAmount), 'solver not slashed');
    const execution = await enforcer.executions(executionId);
    assert.equal(execution.startTime, 0, 'execution not deleted');
  });

  it('allow submit result of valid execution and slash challenger', async () => {
    const _solverPathRoot = solverPathRoot.replace('11', 'aa');

    let tx = await enforcer.register(
      taskHash, _solverPathRoot, proof.resultProof, proof.returnData.replace('00', '99'),
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
    const resultBytes = proof.returnData.replace('00', '99');

    tx = await enforcer.register(
      taskHash, _solverPathRoot, proof.resultProof, resultBytes,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );
    tx = await tx.wait();

    // should not work the second time 😊
    tx = enforcer.register(
      taskHash, _solverPathRoot, proof.resultProof, proof.returnData,
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

  it('not allow registration with invalid resultProof (returnData)', async () => {
    const { solverPathRoot, resultProof, returnData } = await newExecution(maxExecutionDepth);
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof, '0x1111',
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'invalid resultProof');
  });

  it('not allow registration with invalid resultProof (resultProof array)', async () => {
    const { solverPathRoot, resultProof, returnData } = await newExecution(maxExecutionDepth);
    let tx = enforcer.register(
      taskHash, solverPathRoot, resultProof.slice(-1), returnData,
      { value: bondAmount, gasLimit: GAS_LIMIT }
    );

    await assertRevert(tx, 'invalid resultProof');
  });
});
