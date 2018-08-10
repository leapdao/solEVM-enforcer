import fixtures from './fixtures';

const OP = require('./helpers/constants');
const { PUSH1, BLOCK_GAS_LIMIT } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

const opcodes = Object.keys(OP).reduce((s, k) => { s[OP[k]] = k; return s; }, {});

const toNum = arr => arr.map(e => e.toNumber());

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
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count', async function () {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
      const data = '0x';
      let r = unpack(await rt.executeAndStop(code, data, [0, 2, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [3]);

      r = unpack(await rt.executeAndStop(code, data, [0, 4, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [3, 5]);

      r = unpack(await rt.executeAndStop(code, data, [0, 5, BLOCK_GAS_LIMIT]));
      assert.deepEqual(toNum(r.stack), [8]);
    });
  });

  const unpack = ([err, stack, accounts, logs, bytes, bytesOffsets]) => {
    bytes = bytes.substring(2);
    bytesOffsets = bytesOffsets.map(o => o * 2);
    const returnData = `0x${bytes.substring(0, bytesOffsets[0])}`;
    const memory = `0x${bytes.substring(bytesOffsets[0], bytesOffsets[0] + bytesOffsets[1])}`;
    const accountsCode = `0x${bytes.substring(bytesOffsets[1], bytesOffsets[1] + bytesOffsets[2])}`;
    const logsData = `0x${bytes.substring(bytesOffsets[2], bytesOffsets[2] + bytesOffsets[3])}`;
    return { err, returnData, stack, memory, accounts, accountsCode, logs, logsData };
  };

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
      let code = `0x${opcode}`;
      let pc = 0;
      // if not a single opcode, but a program
      if (opcode.join) {
        pc = opcode.length - 1;
        code = `0x${opcode.join('')}`;
        opcode = opcode[pc];
      }
      it(opcodes[opcode], async () => {
        const initialStack = fixture.stack || [];
        const initialMemory = fixture.memory || '0x';
        const initialAccounts = Object.keys(fixture.accounts || {});
        const initialBalances = Object.values(fixture.accounts || {});
        const { stack } = unpack(
          await rt.initAndExecute(
            code, '0x', [pc, 0, BLOCK_GAS_LIMIT], initialStack, initialMemory, initialAccounts, initialBalances
          )
        );
        if (fixture.result.stack) {
          assert.deepEqual(toNum(stack), fixture.result.stack);
        }
      });
    });
  });
});
