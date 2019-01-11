import { toStr, getCodeWithStep, deployContract } from './utils';

import onChainFixtures from './onChain.fixtures';
import Runtime from './helpers/runtimeAdapter';

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

contract('Runtime', function () {
  let rt;

  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('execute - stop - execute one step - compare', () => {
    onChainFixtures.forEach(fixture => {
      const { code, step, opcodeUnderTest } = getCodeWithStep(fixture);
      const data = fixture.data || '0x';

      it(opcodeUnderTest, async () => {
        // 1. export the state right before the target opcode (this supposed to be off-chain)
        const beforeState = await rt.execute({ code, data, pc: 0, stepCount: step });
        // 2. export state right after the target opcode (this supposed to be off-chain)
        const afterState = await rt.execute({ code, data, pc: 0, stepCount: step + 1 });

        // 3. init with beforeState and execute just one step (target opcode) (this supposed to be on-chain)
        // console.log('Before', beforeState.stack);
        const onChainState = await rt.execute(
          {
            code,
            data,
            pc: beforeState.pc,
            stepCount: 1,
            gasRemaining: beforeState.gasRemaining,
            stack: beforeState.stack,
            mem: beforeState.mem,
            accounts: beforeState.accounts,
            accountsCode: beforeState.accountsCode,
            logHash: beforeState.logHash,
          }
        );
        // console.log('After', onChainState.stack);

        // 4. check that on-chain state is the same as off-chain
        assert.deepEqual(toStr(onChainState.stack), toStr(afterState.stack), 'Stack');
        assert.equal(onChainState.mem, afterState.mem, 'Memory');
        assert.deepEqual(onChainState.accounts, afterState.accounts, 'Accounts');
        assert.equal(onChainState.accountsCode, afterState.accountsCode, 'Accounts code');
        assert.equal(onChainState.logHash, afterState.logHash, 'Log hash');
      });
    });
  });
});
