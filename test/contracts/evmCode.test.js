const { deployContract } = require('./../helpers/utils');

const EVMCodeMock = artifacts.require('EVMCodeMock.sol');
const assert = require('assert');

contract('TestEVMCode', function () {
  let evmCode;

  before(async () => {
    evmCode = await deployContract(EVMCodeMock);
  });

  it('fromArray', async function () {
    await evmCode.testFromArrayGetOpcode();
  });

  it('fromArray 2 element wrong order', async function () {
    await assert.rejects(evmCode.testError_FromArrayWrongOrder());
  });

  it('toUint', async function () {
    await evmCode.testToUint();
  });
});
