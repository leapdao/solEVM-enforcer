import { toNum, unpack, opcodeNames } from './utils';
import onChainFixtures from './onChain.fixtures';

const OP = require('./helpers/constants');
const { BLOCK_GAS_LIMIT } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

contract('Runtime', function () {
  let rt;
  
  before(async () => {
    rt = await EthereumRuntime.new();
  });

  const executeAndStop = (code, data, params) => {
    assert(params.length === 4);
    return rt.execute(code, data, params, [], '0x', [], '0x', [], '0x');
  };

  const initAndExecute = (code, data, params, stack, memory, accounts, accountsCode, logs, logsData) => {
    assert(params.length === 4);
    return rt.execute(code, data, params, stack, memory, accounts, accountsCode, logs, logsData);
  };

  describe('execute - stop - execute one step - compare', () => {
    const getCode = (fixture) => {
      let code;
      if (!fixture.join) {
        code = fixture.code || [];
      } else {
        code = fixture;
      }

      code = `0x${code.join('')}`;
      const codeSize = (code.length - 2) / 2;
      const pc = fixture.pc !== undefined ? fixture.pc : codeSize - 1;
      const opcodeUnderTest = opcodeNames[code.substring(2 + pc * 2, 2 + pc * 2 + 2)];
      return { code, codeSize, pc, opcodeUnderTest };
    };

    onChainFixtures.forEach(fixture => {
      const { code, codeSize, pc, opcodeUnderTest } = getCode(fixture);
      const callData = fixture.data || '0x';

      it(opcodeUnderTest, async () => {
        // 1. export the state right before the target opcode (this supposed to be off-chain)
        const beforeState = unpack(await executeAndStop(code, callData, [0, pc, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]));
        // 2. export state right after the target opcode (this supposed to be off-chain)
        const afterState = unpack(await executeAndStop(code, callData, [0, pc + 1, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]));
        
        // 3. init with beforeState and execute just one step (target opcode) (this supposed to be on-chain)
        const pcStart = pc;
        // if pcStart is the last opcode then run till the end (pcEnd = 0)
        const pcEnd = pcStart === codeSize - 1 ? 0 : pcStart + 1;
        const onChainState = unpack(
          await initAndExecute(
            code, callData,
            [pcStart, pcEnd, BLOCK_GAS_LIMIT, beforeState.gasRemaining],
            beforeState.stack, beforeState.memory, beforeState.accounts, beforeState.accountsCode,
            beforeState.logs, beforeState.logsData
          )
        );

        // 4. check that on-chain state is the same as off-chain
        assert.deepEqual(toNum(onChainState.stack), toNum(afterState.stack), 'Stack');
        assert.equal(onChainState.memory, afterState.memory, 'Memory');
        assert.deepEqual(onChainState.accounts, afterState.accounts, 'Accounts');
        assert.equal(onChainState.accountsCode, afterState.accountsCode, 'Accounts code');
        assert.deepEqual(onChainState.logs, afterState.logs, 'Logs');
        assert.equal(onChainState.logsData, afterState.logsData, 'Logs data');
      });
    });
  });
});
