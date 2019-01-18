
import { deployContract, wallets, opcodeNames } from './utils';

// const SimpleToken = artifacts.require('SimpleToken.sol');
const SpendingConditionMock = artifacts.require('SpendingConditionMock.sol');
const Interceptor = artifacts.require('Interceptor.sol');

contract('Interceptor', () => {
  let tokenContract;
  let spendingCondition;
  let interceptor;
  let bridgeContract;

  before(async () => {
    // tokenContract = await deployContract(SimpleToken);
    tokenContract = { address: '0xFc99E0a69A2D7F99153A7F07F7907Fb30F24FDB7' };
    bridgeContract = { address: '0xFc99E0a69A2D7F99153A7F07F7907Fb30F24FDB7' };
    spendingCondition = await deployContract(SpendingConditionMock);
    interceptor = await deployContract(Interceptor);
  });

  describe('SpendingConditionMock', () => {
    it('should pass', async () => {
      let tx;// = await tokenContract.mint(spendingCondition.address, 0xffff);
      // tx = await tx.wait();

      let data = spendingCondition.interface.functions.test.encode(
        [tokenContract.address, [wallets[0].address], [0xffff]]
      );

      tx = await interceptor.run(
        {
          caller: wallets[0].address,
          spendingCondition: spendingCondition.address,
          tokenContract: tokenContract.address,
          bridgeContract: bridgeContract.address,
          callData: data,
        }
      );
      tx = await tx.wait();

      tx.events.forEach(
        (ele) => {
          if (ele.args.code) {
            let code = [];
            let codes = ele.args.code.substring(2, ele.args.code.length);

            for (let i = 0; i < codes.length; i += 2) {
              code.push(codes.substring(i, i + 2));
            }
            return;
          }

          if (ele.args.pc !== undefined) {
            let hexStr = ele.args.opcode.toString(16);
            if (hexStr.length === 1) {
              hexStr = '0' + hexStr;
            }
            console.log(ele.args.stepRun + ' pc=' + ele.args.pc + 'opcode=' + opcodeNames[hexStr]);
            return;
          }

          console.log(ele.args);
        }
      );
    });
  });
});
