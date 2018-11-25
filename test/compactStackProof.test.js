import EVMInvalid from './helpers/EVMInvalid';
import {getHash} from './helpers/hash'

const OP = require('./helpers/constants');
const { ADD, BLOCK_GAS_LIMIT } = OP;
const CompactStackProofMock = artifacts.require('CompactStackProofMock.sol');
const EthereumRuntime = artifacts.require('EthereumRuntime.sol');
const should = require('chai').use(require('chai-as-promised')).should();

contract('TestCompactStackProof', function () {
  let stackVerifier;
  let ethRuntime;

  before(async () => {
    ethRuntime = await EthereumRuntime.new();
    stackVerifier = await CompactStackProofMock.new(ethRuntime.address);
  });

  it('set runtime address correctly', async function () {
    assert(await stackVerifier.ethRuntime() == ethRuntime.address, 'runtime address is not correct');
  });

  it('can prove operation with full stack', async function () {
    let fullPrevStack = [1, 1, 2, 3, 5, 8];
    let fullNextStack = [1, 1, 2, 3, 13];
    let result = await stackVerifier.verify(
      '0x' + ADD,
      '0x',
      [0, 1, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT],
      fullPrevStack,
      '0x',
      getHash(fullPrevStack, 0),
      0, // hash sibling
      getHash(fullNextStack, 0)
    );
    assert(result.logs[0].args.result == true, 'stack proof is incorrect');
  });

  it('can prove operation with partial stack', async function () {
    let fullPrevStack = [1, 1, 2, 3, 5];
    let fullNextStack = [1, 1, 2, 8];
    let result = await stackVerifier.verify(
      '0x' + ADD,
      '0x',
      [0, 1, BLOCK_GAS_LIMIT, BLOCK_GAS_LIMIT],
      fullPrevStack.slice(3, 5),
      '0x',
      getHash(fullPrevStack, 0),
      getHash(fullPrevStack.slice(0, 3), 0),
      getHash(fullNextStack, 0)
    );
    assert(result.logs[0].args.result == true, 'stack proof is incorrect');
  });
});
