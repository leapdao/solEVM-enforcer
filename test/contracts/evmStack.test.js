
const { deployContract } = require('./../helpers/utils');

const EVMStackMock = artifacts.require('EVMStackMock.sol');
const assert = require('assert');

contract('TestEVMStack', function () {
  let stack;

  before(async () => {
    stack = await deployContract(EVMStackMock);
  });

  it('dupThrowsNTooSmall', async function () {
    await assert.rejects(stack.dupThrowsNTooSmall());
  });

  it('dupThrowsNTooLarge', async function () {
    await assert.rejects(stack.dupThrowsNTooLarge());
  });

  it('dupThrowsUnderflow', async function () {
    await assert.rejects(stack.dupThrowsUnderflow());
  });

  it('popThrowsUnderflow', async function () {
    await assert.rejects(stack.popThrowsUnderflow());
  });

  it('pushThrowsOverflow', async function () {
    await assert.rejects(stack.pushThrowsOverflow());
  });

  it('dupThrowsOverflow', async function () {
    await assert.rejects(stack.dupThrowsOverflow());
  });

  // if those calls fail, they will throw
  it('testCreate', async function () {
    await stack.testCreate();
  });

  it('testPush', async function () {
    await stack.testPush();
  });

  it('testPop', async function () {
    await stack.testPop();
  });

  it('testDup1', async function () {
    await stack.testDup1();
  });

  it('testDup16', async function () {
    await stack.testDup16();
  });

  it('testSwap1', async function () {
    await stack.testSwap1();
  });

  it('testSwap16', async function () {
    await stack.testSwap16();
  });
});
