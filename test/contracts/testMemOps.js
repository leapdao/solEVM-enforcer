const { deployContract } = require('./../helpers/utils');

const TestMemOps = artifacts.require('TestMemOps.sol');

contract('TestMemOps', function () {
  let contract;

  before(async () => {
    contract = await deployContract(TestMemOps);
  });

  // if those calls fail, they will throw
  it('testAllocate32', async function () {
    await (await contract.testAllocate32()).wait();
  });

  it('testMemcopy32', async function () {
    await (await contract.testMemcopy32()).wait();
  });
});
