import { toNum, getCode, deployContract } from './utils';

import onChainFixtures from './onChain.fixtures';
import Runtime from './helpers/runtimeAdapter';

const OP = require('./helpers/constants');
const { BLOCK_GAS_LIMIT } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

contract('Runtime', function () {
  let rt;
  
  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('execute - stop - execute one step - compare', () => {
    onChainFixtures.forEach(fixture => {
      const { code, codeSize, pc, opcodeUnderTest } = getCode(fixture);
      const callData = fixture.data || '0x';

      it(opcodeUnderTest, async () => {
        // 1. export the state right before the target opcode (this supposed to be off-chain)
        const beforeState = await rt.executeAndStop(code, callData, [0, pc, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
        // 2. export state right after the target opcode (this supposed to be off-chain)
        const afterState = await rt.executeAndStop(code, callData, [0, pc + 1, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT]);
        
        // 3. init with beforeState and execute just one step (target opcode) (this supposed to be on-chain)
        const pcStart = pc;
        // if pcStart is the last opcode then run till the end (pcEnd = 0)
        const pcEnd = pcStart === codeSize - 1 ? 0 : pcStart + 1;
        const onChainState = await rt.initAndExecute(
          code, callData,
          [pcStart, pcEnd, BLOCK_GAS_LIMIT, beforeState.gasRemaining],
          beforeState.stack, beforeState.mem, beforeState.accounts, beforeState.accountsCode,
          beforeState.logHash,
        );

        // 4. check that on-chain state is the same as off-chain
        assert.deepEqual(toNum(onChainState.stack), toNum(afterState.stack), 'Stack');
        assert.equal(onChainState.mem, afterState.mem, 'Memory');
        assert.deepEqual(onChainState.accounts, afterState.accounts, 'Accounts');
        assert.equal(onChainState.accountsCode, afterState.accountsCode, 'Accounts code');
        assert.equal(onChainState.logHash, afterState.logHash, 'Log hash');
      });
    });
  });
});
