import fixtures from './fixtures';

const OP = require('./helpers/constants');
const { PUSH1, BLOCK_GAS_LIMIT } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

const opcodes = Object.keys(OP).reduce((s, k) => { s[OP[k]] = k; return s; }, {});

const toNum = arr => arr.map(e => e.toNumber());
const toHex = arr => arr.map(e => e.toString(16));

const unpack = ([uints, stack, accounts, logs, bytes, bytesOffsets]) => {   
  bytes = bytes.substring(2);
  bytesOffsets = bytesOffsets.map(o => o * 2);
  const returnData = `0x${bytes.substring(0, bytesOffsets[0])}`;
  const memory = `0x${bytes.substring(bytesOffsets[0], bytesOffsets[0] + bytesOffsets[1])}`;
  const accountsCode = `0x${bytes.substring(bytesOffsets[1], bytesOffsets[1] + bytesOffsets[2])}`;
  const logsData = `0x${bytes.substring(bytesOffsets[2], bytesOffsets[2] + bytesOffsets[3])}`;
  const [errno, errpc, pc, gasRemaining] = uints.map(n => n.toNumber());
  return { errno, errpc, pc, returnData, stack, memory, accounts, accountsCode, logs, logsData, gasRemaining };
};

contract('Runtime', function () {
  let rt;
  
  before(async () => {
    rt = await EthereumRuntime.new();
  });

  it('should allow to add', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    let rv = unpack(await rt.executeFlat(code, data));
    assert.equal(rv.stack[0], 8);
    assert.deepEqual(rv.pc, 5);
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count and export the state', async function () {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD + PUSH1 + '00' + OP.MSTORE;
      const data = '0x';
      let r = unpack(await rt.executeAndStop(code, data, [0, 2, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [3]);
      assert.deepEqual(r.pc, 2);
      assert.deepEqual(r.memory, '0x');

      r = unpack(await rt.executeAndStop(code, data, [0, 4, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [3, 5]);

      r = unpack(await rt.executeAndStop(code, data, [0, 5, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [8]);
      r = unpack(await rt.executeAndStop(code, data, [0, 8, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), []);
      assert.deepEqual(r.pc, 8);
      assert.deepEqual(parseInt(r.memory, 16), 8);
    });
  });

  describe('initAndExecute', () => {
    it('can continue from non-zero program counter', async () => {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
      const res = unpack(await rt.executeAndStop(code, '0x', [0, 4, BLOCK_GAS_LIMIT]));
      const { stack } = unpack(
        await rt.initAndExecute(code, '0x', [4, 0, BLOCK_GAS_LIMIT], res.stack, res.memory, [], [])
      );
      assert.deepEqual(toNum(stack), [8]);
    });

    fixtures.forEach(fixture => {
      let opcode = fixture.opcode;
      let code;
      let pc;
      // if not a single opcode, but a program
      if (opcode.join) {
        pc = fixture.pc || opcode.length - 1;
        code = `0x${opcode.join('')}`;
        opcode = opcode[pc];
      } else {
        pc = fixture.pc || 0;
        code = `0x${opcode}`;
      }
      it(opcodes[opcode], async () => {
        const initialStack = fixture.stack || [];
        const initialMemory = fixture.memory || '0x';
        const initialAccounts = Object.keys(fixture.accounts || {});
        const initialBalances = Object.values(fixture.accounts || {});
        const callData = fixture.data || '0x';
        const gasLimit = fixture.gasLimit || BLOCK_GAS_LIMIT;
        const res = unpack(
          await rt.initAndExecute(
            code, callData,
            [pc, 0, gasLimit],
            initialStack, initialMemory, initialAccounts, initialBalances
          )
        );

        if (fixture.result.stack) {
          assert.deepEqual(toNum(res.stack), fixture.result.stack);
        }
        if (fixture.result.memory) {
          assert.deepEqual(res.memory, fixture.result.memory);
        }
        if (fixture.result.logs) {
          assert.deepEqual(toHex(res.logs), fixture.result.logs);
        }
        if (fixture.result.pc !== undefined) {
          assert.deepEqual(res.pc, fixture.result.pc);
        }
        if (fixture.result.gasUsed !== undefined) {
          assert.equal(res.gasRemaining, gasLimit - fixture.result.gasUsed);
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.errno, fixture.result.errno);
        }
      });
    });
  });

  it('should have enough gas', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    const gas = 9;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    // should have zero gas left
    assert.equal(res.gasRemaining, 0);
  });

  it('should run out of gas', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    const gas = 8;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    // 13 = out of gas
    assert.equal(res.errno, 13);
  });

  it('(OP.CALL) should run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.CALL;
    const data = '0x';
    const gas = 200;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    // 13 = out of gas
    assert.equal(res.errno, 13);
  });

  it('(OP.CALL) should not run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.CALL;
    const data = '0x';
    const gas = 2000;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    assert.equal(res.errno, 0);
  });

  it('(OP.DELEGATECALL) should run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.DELEGATECALL;
    const data = '0x';
    const gas = 200;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    // 13 = out of gas
    assert.equal(res.errno, 13);
  });

  it('(OP.DELEGATECALL) should not run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.DELEGATECALL;
    const data = '0x';
    const gas = 2000;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    assert.equal(res.errno, 0);
  });

  it('(OP.STATICCALL) should run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.STATICCALL;
    const data = '0x';
    const gas = 200;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    // 13 = out of gas
    assert.equal(res.errno, 13);
  });

  it('(OP.STATICCALL) should not run out of gas', async function () {
    const code =
      '0x' +
      // gas
      PUSH1 + 'ff' +
      // targetAddr
      PUSH1 + '00' +
      // value
      PUSH1 + '00' +
      // inOffset
      PUSH1 + '00' +
      // inSize
      PUSH1 + '00' +
      // retOffset
      PUSH1 + '00' +
      // retSize
      PUSH1 + '00' +
      OP.STATICCALL;
    const data = '0x';
    const gas = 2000;

    let res = unpack(await rt.executeAndStop(code, data, [0, 0, gas]));
    assert.equal(res.errno, 0);
  });
});
