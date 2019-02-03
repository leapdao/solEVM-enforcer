
const EVMStackMock = artifacts.require('EVMStackMock.sol');
const assert = require('assert');

contract('TestEVMStack', function () {
  let stack;

  before(async () => {
    stack = await EVMStackMock.new();
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
});
