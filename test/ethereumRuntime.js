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
    it('should allow to run a specific number of steps', async () => {
      // codepointers: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, A, B, C
      // execution order: 0, 1, 2, 8, 9, A, B, 3, 4, 5, 6, 7, C
      const code = [
        OP.PUSH1, '08', OP.JUMP, // jump to 0x08
        OP.JUMPDEST, OP.GASLIMIT, OP.PUSH1, '0C', OP.JUMP, // 0x03. Jump to 0x0c
        OP.JUMPDEST, OP.PUSH1, '03', OP.JUMP, // 0x08. Jump to 0x03
        OP.JUMPDEST, // 0x0c
      ];
      const data = '0x';

      const executeStep = async (stepCount) =>
        (await rt.execute(
          {
            code: `0x${code.join('')}`,
            data: data,
            pc: 0,
            stepCount: stepCount,
          }
        )).pc;
      assert.equal(await executeStep(1), 2, 'should be at 2 JUMP');
      assert.equal(await executeStep(2), 8, 'should be at 8 JUMPDEST');
      assert.equal(await executeStep(3), 9, 'should be at 9 PUSH1');
      assert.equal(await executeStep(4), 11, 'should be at 11 JUMP');
      assert.equal(await executeStep(5), 3, 'should be at 3 JUMPDEST');
    });
  });

  describe('initAndExecute', () => {
    it('can continue from non-zero program counter', async () => {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
      const res = await rt.execute(
        {
          code: code,
          pc: 0,
          stepCount: 2,
        }
      );
      const { stack } = await rt.execute(
        {
          code,
          pc: 4,
          stepCount: 0,
          stack: res.stack,
          mem: res.mem,
        }
      );
      assert.deepEqual(toNum(stack), [8]);
    });

    fixtures.forEach(fixture => {
      const { code, pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const stack = fixture.stack || [];
        const mem = fixture.memory || '0x';
        const { accounts, accountsCode } = encodeAccounts(fixture.accounts || []);
        const data = fixture.data || '0x';
        const gasLimit = fixture.gasLimit || BLOCK_GAS_LIMIT;
        const logHash = fixture.logHash;
        const res = await rt.execute({ code, data, pc, gasLimit, stack, mem, accounts, accountsCode, logHash });

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
    const gasLimit = 9;

    const res = await rt.execute({ code, data, gasLimit });
    // should have zero gas left
    assert.equal(res.gasRemaining, 0);
  });

  it('should run out of gas', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    const gasLimit = 8;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 200;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 2000;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 200;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 2000;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 200;

    const res = await rt.execute({ code, data, gasLimit });
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
    const gasLimit = 2000;

    const res = await rt.execute({ code, data, gasLimit });
    assert.equal(res.errno, 0);
  });
});
