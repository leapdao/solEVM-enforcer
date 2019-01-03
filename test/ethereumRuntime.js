import { toNum, toStr, encodeAccounts, decodeAccounts, getCode, deployContract } from './utils';
import fixtures from './fixtures';
import Runtime from './helpers/runtimeAdapter';

const OP = require('./helpers/constants');
const { PUSH1, BLOCK_GAS_LIMIT, DEFAULT_CALLER } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

contract('Runtime', function () {
  let rt;

  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count and export the state', async function () {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD + PUSH1 + '00' + OP.MSTORE;
      const data = '0x';
      let r = await rt.executeAndStop(code, data, [0, 2, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
      assert.deepEqual(toNum(r.stack), [3]);
      assert.equal(r.pc, 2);
      assert.equal(r.mem, '0x');

      r = await rt.executeAndStop(code, data, [0, 4, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
      assert.deepEqual(toNum(r.stack), [3, 5]);

      r = await rt.executeAndStop(code, data, [0, 5, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
      assert.deepEqual(toNum(r.stack), [8]);
      r = await rt.executeAndStop(code, data, [0, 8, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
      assert.deepEqual(toNum(r.stack), []);
      assert.equal(r.pc, 8);
      assert.equal(parseInt(r.mem, 16), 8);
    });

    it('should work with JUMPs', async () => {
      //    codepointers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A, B, C
      // execution order: 0, 1, 2, 8, 9, A, B, 3, 4, 5, 6, 7, C
      const code = [
        OP.PUSH1, '08', OP.JUMP, // jump to 0x08
        OP.JUMPDEST, OP.GASLIMIT, OP.PUSH1, '0C', OP.JUMP, // 0x03. Jump to 0x0c
        OP.JUMPDEST, OP.PUSH1, '03', OP.JUMP, // 0x08. Jump to 0x03
        OP.JUMPDEST, // 0x0c
      ];
      const data = '0x';

      const executeTill = async (stopAt) =>
        (await rt.executeAndStop(
          `0x${code.join('')}`, data, [0, stopAt, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]
        )).pc.toNumber();
      
      assert.equal(await executeTill(2), 2);
      assert.equal(await executeTill(3), 3);
      assert.equal(await executeTill(5), 5);
      assert.equal(await executeTill(12), 12);
    });
  });

  describe('initAndExecute', () => {
    it('can continue from non-zero program counter', async () => {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
      const res = await rt.executeAndStop(code, '0x', [0, 4, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
      const { stack } = await rt.initAndExecute(
        code,
        '0x',
        [4, 0, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT],
        res.stack,
        res.mem
      );
      assert.deepEqual(toNum(stack), [8]);
    });

    fixtures.forEach(fixture => {
      const { code, pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const initialStack = fixture.stack || [];
        const initialMemory = fixture.memory || '0x';
        const { accounts, accountsCode } = encodeAccounts(fixture.accounts || []);
        const callData = fixture.data || '0x';
        const blockGasLimit = fixture.blockGasLimit || BLOCK_GAS_LIMIT;
        const gasLimit = fixture.gasLimit || blockGasLimit;
        const logHash = fixture.logHash;
        const callArgs = [
          code,
          callData,
          [pc, 0, blockGasLimit, gasLimit],
          initialStack,
          initialMemory,
          accounts,
          accountsCode,
          logHash,
        ];
        const res = await rt.initAndExecute(...callArgs);

        if (fixture.result.stack) {
          assert.deepEqual(toStr(res.stack), fixture.result.stack);
        }
        if (fixture.result.memory) {
          assert.deepEqual(res.mem, fixture.result.memory);
        }
        if (fixture.result.accounts) {
          const accounts = Array.from(fixture.result.accounts);

          accounts.push({
            address: `0x${DEFAULT_CALLER}`,
            balance: 0,
            nonce: 0,
            destroyed: false,
            code: '',
            storage: [],
          });
          const accs = decodeAccounts(res.accounts, res.accountsCode);
          const accsMap = accs.reduce((m, a) => { m[a.address] = a; return m; }, {});
          accounts.forEach(account => {
            const expectedAccount = accsMap[account.address];
            assert.isTrue(!!expectedAccount);
            if (account.balance) {
              assert.equal(expectedAccount.balance, account.balance);
            }
            if (account.storage) {
              assert.deepEqual(expectedAccount.storage, account.storage);
            }
          });
        }
        if (fixture.result.logHash) {
          assert.equal(res.logHash, fixture.result.logHash, 'logHash');
        }
        if (fixture.result.pc !== undefined) {
          assert.equal(res.pc.toNumber(), fixture.result.pc, 'pc');
        }
        if (fixture.result.gasUsed !== undefined) {
          assert.equal(gasLimit - parseInt(res.gasRemaining), fixture.result.gasUsed, 'gasUsed');
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.errno, fixture.result.errno, 'errno');
        }
      });
    });
  });

  it('should have enough gas', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    const gas = 9;

    const res = await rt.execute(code, data, gas);
    // should have zero gas left
    assert.equal(res.gasRemaining, 0);
  });

  it('should run out of gas', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    const gas = 8;

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
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

    const res = await rt.execute(code, data, gas);
    assert.equal(res.errno, 0);
  });
});
