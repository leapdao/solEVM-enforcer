
const { getCodeWithStep, deployContract, deployCode } = require('./../helpers/utils');
const onChainFixtures = require('./../fixtures/onChain');
const Runtime = require('./../../utils/EthereumRuntimeAdapter');

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
      let gasCost;

      it(opcodeUnderTest, async () => {
        const codeContract = await deployCode(code);
        // 1. export the state right before the target opcode (this supposed to be off-chain)
        const beforeState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: 0,
            stepCount: step,
          }
        );
        // 2. export state right after the target opcode (this supposed to be off-chain)
        const afterState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: 0,
            stepCount: step + 1,
          }
        );

        // 3. init with beforeState and execute just one step (target opcode) (this supposed to be on-chain)
        // console.log('Before', beforeState.stack);
        const onChainState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: beforeState.pc,
            stepCount: 1,
            gasRemaining: beforeState.gas,
            stack: beforeState.stack,
            mem: beforeState.mem,
            accounts: beforeState.accounts,
            accountsCode: beforeState.accountsCode,
            logHash: beforeState.logHash,
          }
        );
        gasCost = onChainState.gas;

        // 4. check that on-chain state is the same as off-chain
        // checking hashValue is enough to say that states are same
        assert.equal(onChainState.hashValue, afterState.hashValue, 'State Hash');

        const oogState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: beforeState.pc,
            stepCount: 1,
            gasRemaining: beforeState.gas,
            gasLimit: gasCost - 1,
            stack: beforeState.stack,
            mem: beforeState.mem,
            accounts: beforeState.accounts,
            accountsCode: beforeState.accountsCode,
            logHash: beforeState.logHash,
          }
        );

        assert.equal(oogState.errno, 13, 'Not out of gas');
      });
    });
  });
});
