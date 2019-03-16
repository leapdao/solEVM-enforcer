const { getCodeWithStep, deployContract, deployCode, toBN } = require('./../helpers/utils');
const onChainFixtures = require('./../fixtures/onChain');
const Runtime = require('./../../utils/EthereumRuntimeAdapter');

const OP = require('./../../utils/constants');
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

        // 4. check that on-chain state is the same as off-chain
        // checking hashValue is enough to say that states are same
        assert.equal(onChainState.hashValue, afterState.hashValue, 'State Hash');

        // 5. run again with limited gas
        if (onChainState.errno > 0 || onChainState.gas === beforeState.gas) {
          // skip test out of gas if already an error or cost nothing
          return;
        }
        gasCost = onChainState.gas;
        let limitedGas = toBN(OP.BLOCK_GAS_LIMIT) - gasCost - 1;
        if (limitedGas < 0) limitedGas = 0;

        const oogState = await rt.execute(
          {
            code: codeContract.address,
            data,
            pc: 0,
            stepCount: 0,
            gasRemaining: limitedGas,
          }
        );
        assert.equal(oogState.errno, OP.ERROR_OUT_OF_GAS, 'Not out of gas');
      });
    });
  });

  describe('Special tests', () => {
    it('Stack overflow', async () => {
      let code = [OP.PUSH1, '00'];
      for (let i = 0; i < 1024; i++) {
        code.push(OP.DUP1);
      }
      let codeContract = await deployCode(code);
      const onChainState = await rt.execute(
        {
          code: codeContract.address,
          data: '0x',
          pc: 0,
          stepCount: 0,
        }
      );
      assert.equal(onChainState.errno, OP.ERROR_STACK_OVERFLOW);
    });

    it('Limited gas', async () => {
      let code = [OP.PUSH1, '00'];
      let codeContract = await deployCode(code);
      const onChainState = await rt.execute(
        {
          code: codeContract.address,
          data: '0x',
          pc: 0,
          stepCount: 0,
          gasRemaining: 2,
          gasLimit: 1,
        }
      );
      assert.equal(onChainState.errno, OP.ERROR_OUT_OF_GAS);
    });
  });
});
