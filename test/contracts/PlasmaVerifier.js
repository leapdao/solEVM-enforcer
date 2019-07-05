
const { wallets, deployContract, txOverrides, opcodeNames } = require('./../helpers/utils');

const SpendingConditionMock = artifacts.require('SpendingConditionMock.sol');
const Interceptor = artifacts.require('PlasmaVerifier.sol');

contract('PlasmaVerifier', () => {
  // skip test if we do coverage
  if (process.env.COVERAGE) {
    return;
  }

  const receivers = [
    '0x1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a',
    '0x1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b',
  ];
  const txAmounts = [
    0xffff,
    0xfafa,
  ];
  let tokenContract;
  let spendingCondition;
  let interceptor;

  before(async () => {
    tokenContract = { address: '0xFc99E0a69A2D7F99153A7F07F7907Fb30F24FDB7' };
    spendingCondition = await deployContract(SpendingConditionMock);
    interceptor = await deployContract(Interceptor, 1000000);
  });

  it('should pass with SpendingConditionMock', async () => {
    let tx;
    let data = spendingCondition.interface.functions.test.encode(
      [tokenContract.address, receivers, txAmounts]
    );

    tx = await interceptor.testRun(
      {
        caller: wallets[0].address,
        spendingCondition: spendingCondition.address,
        callData: data,
      },
      txOverrides
    );
    tx = await tx.wait();

    tx.events.forEach(
      (ele) => {
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
