const { deployContract } = require('./../helpers/utils');

const EVMCodeMock = artifacts.require('EVMCodeMock.sol');
const assert = require('assert');

contract('TestEVMCode', function () {
  let evmCode;

  before(async () => {
    evmCode = await deployContract(EVMCodeMock);
  });

  it('test to uint', async function () {
    let res = await evmCode.testToUint(
      [
        {
          pos: 0,
          value: '0x7f10111213141516171819202122232425262728293031323334353637383940',
        },
        {
          pos: 1,
          value: '0x4100000000000000000000000000000000000000000000000000000000000000',
        },
      ],
      2,
      33,
      1,
      32
    );
    assert(res).equal(1);
  });
});
