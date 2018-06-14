import EVMInvalid from './helpers/EVMInvalid';
import chai from 'chai';

const should = chai
  .use(require('chai-as-promised'))
  .should();

const EVMStackMock = artifacts.require('EVMStackMock.sol');

contract('TestEVMStack', function (accounts) {
  let stack;
  before(async () => {
    stack = await EVMStackMock.new();
  });

  it('dupThrowsNTooSmall', async function () {
    await stack.dupThrowsNTooSmall().should.be.rejectedWith(EVMInvalid);
  });

  it('dupThrowsNTooLarge', async function () {
    await stack.dupThrowsNTooLarge().should.be.rejectedWith(EVMInvalid);
  });

  it('dupThrowsUnderflow', async function () {
    await stack.dupThrowsUnderflow().should.be.rejectedWith(EVMInvalid);
  });

  it('popThrowsUnderflow', async function () {
    await stack.popThrowsUnderflow().should.be.rejectedWith(EVMInvalid);
  });

  it('pushThrowsOverflow', async function () {
    await stack.pushThrowsOverflow().should.be.rejectedWith(EVMInvalid);
  });

  it('dupThrowsOverflow', async function () {
    await stack.dupThrowsOverflow().should.be.rejectedWith(EVMInvalid);
  });

});