'use strict';

const assert = require('assert');

const Merkelizer = require('./../../utils/Merkelizer');
const { sleep, toBytes32, deployContract, txOverrides, deployCode } = require('./../helpers/utils');
const OP = require('./../../utils/constants');
const assertRevert = require('./../helpers/assertRevert');
const GAS_LIMIT = OP.GAS_LIMIT;

const Verifier = require('./../../build/contracts/Verifier.json');
const Enforcer = require('./../../build/contracts/Enforcer.json');

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ONE_HASH = '0x0000000000000000000000000000000000000000000000000000000000000001';
const TWO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000002';
const ZERO_WITNESS_PATH = { left: ZERO_HASH, right: ZERO_HASH };
const SOLVER_VERIFIED = (1 << 2);
const CHALLENGER_VERIFIED = (1 << 3);
const EVMParameters = {
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

async function requestExecution (enforcer, code, callData) {
  const codeContract = await deployCode(code);
  const codeHash = `0x${codeContract.address.replace('0x', '').toLowerCase().padEnd(64, '0')}`;
  const dataHash = Merkelizer.dataHash(callData);
  const params = Object.assign(EVMParameters, { codeHash, dataHash });

  let tx = await enforcer.request(params, callData);
  tx = await tx.wait();

  const taskHash = tx.events[0].args.taskHash;

  return { taskHash, params };
}

describe('Verifier', function () {
  const timeoutDuration = 2;
  const taskPeriod = 1000000;
  const challengePeriod = 8;
  const bondAmount = 1;
  const maxExecutionDepth = 10;
  let enforcer;
  let verifier;

  before(async () => {
    verifier = await deployContract(Verifier, timeoutDuration);
    enforcer = await deployContract(
      Enforcer, verifier.address, taskPeriod, challengePeriod, bondAmount, maxExecutionDepth
    );

    let tx = await verifier.setEnforcer(enforcer.address);

    await tx.wait();
  });

  describe('submitProof', async () => {
    it('not allow preemptive submission of proof', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const callData = '0x12345678';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let tx = await enforcer.register(
        taskHash,
        ZERO_HASH,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();

      tx = await enforcer.dispute(
        ZERO_HASH,
        ZERO_HASH,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      let proofs = {
        stackHash: ZERO_HASH,
        memHash: ZERO_HASH,
        dataHash: ZERO_HASH,
      };

      // should not accept submitProof
      await assertRevert(verifier.submitProof(
        disputeId,
        proofs,
        {
          data: '0x12345678',
          stack: [],
          mem: [],
          returnData: '0x',
          pc: 0,
          gasRemaining: GAS_LIMIT,
          stackSize: 0,
          memSize: 0,
          customEnvironmentHash: ZERO_HASH,
        },
        txOverrides
      ));
    });
  });

  describe('claimTimeout', async () => {
    it('non-existent dispute, cannot claim', async () => {
      // TODO geth require to specific gasLimit although the transaction only cost ~50k
      await assertRevert(
        verifier.claimTimeout(toBytes32('NotExist'), { gasLimit: GAS_LIMIT }),
        'dispute not exist'
      );
    });

    it('not yet timeout, cannot claim', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const callData = '0x12345679';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let tx = await enforcer.register(
        taskHash,
        ZERO_HASH,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();

      tx = await enforcer.dispute(
        ZERO_HASH,
        ZERO_HASH,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );

      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      // should not accept submitProof
      await assertRevert(verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT }), 'not timed out yet');
    });

    it('nobody submits anything, solver wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '00',
        OP.RETURN,
      ];
      const callData = '0x12345680';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let tx = await enforcer.register(
        taskHash,
        ZERO_HASH,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      tx = await enforcer.dispute(
        ZERO_HASH,
        ZERO_HASH,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      await sleep(timeoutDuration);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?
      assert.notEqual(dispute.state & SOLVER_VERIFIED, 0, 'solver should win');

      // cannot call claimTimeout a second time
      await assertRevert(verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT }), 'already notified enforcer');
    });

    it('1 round - solver submitted, solver wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '01',
        OP.RETURN,
      ];
      const callData = '0x12345680';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let solverHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);

      let tx = await enforcer.register(
        taskHash,
        solverHash,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      tx = await enforcer.dispute(
        solverHash,
        ZERO_HASH,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();
      let disputeId = tx.events[0].args.disputeId;

      // solver respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await sleep(timeoutDuration);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      assert.notEqual(dispute.state & SOLVER_VERIFIED, 0, 'solver should win');
    });

    it('1 round - challenger submitted, challenger wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.PUSH1, '02',
        OP.RETURN,
      ];
      const callData = '0x12345680';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let tx = await enforcer.register(
        taskHash,
        ZERO_HASH,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let challengerHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);
      tx = await enforcer.dispute(
        ZERO_HASH,
        challengerHash,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let disputeId = tx.events[0].args.disputeId;

      // challenger respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await sleep(timeoutDuration);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?

      assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
    });

    it('1 round - both submitted, waiting proof, challenger wins', async () => {
      const code = [
        OP.PUSH1, '20',
        OP.REVERT,
      ];
      const callData = '0x12345680';
      const { taskHash, params } = await requestExecution(enforcer, code, callData);

      let solverHash = Merkelizer.hash(ONE_HASH, TWO_HASH);
      let tx = await enforcer.register(
        taskHash,
        solverHash,
        [ZERO_HASH],
        ZERO_HASH,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let challengerHash = Merkelizer.hash(ONE_HASH, ZERO_HASH);
      tx = await enforcer.dispute(
        solverHash,
        challengerHash,
        params,
        { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
      );
      tx = await tx.wait();

      let disputeId = tx.events[0].args.disputeId;

      // solver respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: TWO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      // challenger respond
      tx = await verifier.respond(
        disputeId,
        {
          left: ONE_HASH,
          right: ZERO_HASH,
        },
        ZERO_WITNESS_PATH,
        { gasLimit: GAS_LIMIT }
      );

      await sleep(timeoutDuration);

      tx = await verifier.claimTimeout(disputeId, { gasLimit: GAS_LIMIT });
      tx = await tx.wait();

      let dispute = await verifier.disputes(disputeId);
      // TODO may add dispute result directly to Verifier?

      assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
    });
  });

  it('computationPath.left is zero, challenger should win', async () => {
    const code = [
      OP.PUSH1, '20',
      OP.PUSH1, '00',
      OP.RETURN,
    ];
    const callData = '0x12345679';
    const { taskHash, params } = await requestExecution(enforcer, code, callData);

    let tx = await enforcer.register(
      taskHash,
      Merkelizer.hash(ZERO_HASH, ONE_HASH),
      [ZERO_HASH],
      ZERO_HASH,
      { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    tx = await tx.wait();

    tx = await enforcer.dispute(
      Merkelizer.hash(ZERO_HASH, ONE_HASH),
      Merkelizer.hash(ONE_HASH, ZERO_HASH),
      params,
      { value: 1, gasPrice: 0x01, gasLimit: GAS_LIMIT }
    );

    tx = await tx.wait();
    let disputeId = tx.events[0].args.disputeId;

    // challenger
    tx = await verifier.respond(
      disputeId,
      {
        left: ONE_HASH,
        right: ZERO_HASH,
      },
      ZERO_WITNESS_PATH,
      { gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    // solver
    tx = await verifier.respond(
      disputeId,
      {
        left: ZERO_HASH,
        right: ONE_HASH,
      },
      ZERO_WITNESS_PATH,
      { gasLimit: GAS_LIMIT }
    );
    await tx.wait();

    const dispute = await verifier.disputes(disputeId);

    assert.notEqual(dispute.state & CHALLENGER_VERIFIED, 0, 'challenger should win');
  });
});
