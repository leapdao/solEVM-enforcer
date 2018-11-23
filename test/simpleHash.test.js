const SimpleHashMock = artifacts.require('SimpleHashMock.sol');
const should = require('chai').use(require('chai-as-promised')).should();
import {getHash} from './helpers/hash'

contract('TestSimpleHash', function () {
  let simpleHash;
  before(async () => {
    simpleHash = await SimpleHashMock.new();
  });

  it('correctly calculate hash of stack', async function () {
    const arr = [3, 2, 1];
    let result = await simpleHash.testToHashStack(arr, 0);
    assert(result == getHash(arr, 0), 'Stack hash does not matched');
  });

  it('correctly calculate hash of array', async function () {
    const arr = [1, 2, 3];
    let result = await simpleHash.testToHashArray(arr, 0);
    assert(result == getHash(arr, 0), 'Array hash does not matched');
  });
});
