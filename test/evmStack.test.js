import EVMInvalid from './helpers/EVMInvalid';

const EVMStackMock = artifacts.require('EVMStackMock.sol');
const assert = require('assert');

contract('TestEVMStack', function () {
  const errObj = { message: new RegExp(EVMInvalid) };

  let stack;
  before(async () => {
    stack = await EVMStackMock.new();
  });

  it('dupThrowsNTooSmall', async function () {
    await assert.rejects(stack.dupThrowsNTooSmall(), errObj);
  });

  it('dupThrowsNTooLarge', async function () {
    await assert.rejects(stack.dupThrowsNTooLarge(), errObj);
  });

  it('dupThrowsUnderflow', async function () {
    await assert.rejects(stack.dupThrowsUnderflow(), errObj);
  });

  it('popThrowsUnderflow', async function () {
    await assert.rejects(stack.popThrowsUnderflow(), errObj);
  });

  it('pushThrowsOverflow', async function () {
    await assert.rejects(stack.pushThrowsOverflow(), errObj);
  });

  it('dupThrowsOverflow', async function () {
    await assert.rejects(stack.dupThrowsOverflow(), errObj);
  });
});
