import { hashUint256Array } from './helpers/hash';
import { deployContract } from './utils.js';
const HashMock = artifacts.require('HashMock.sol');

contract('TestHash', function () {
  let hashContract;
  before(async () => {
    hashContract = await deployContract(HashMock);
  });

  it('correctly calculate hash of array', async function () {
    const arr = [1, 2, 3];
    let sibling = '0x0000000000000000000000000000000000000000000000000000000000000000';
    let result = await hashContract.testToHashArray(arr, sibling);
    assert(result === hashUint256Array(arr, 0), 'Array hash does not matched');
  });

  it('correctly calculate hash of array with sibling', async function () {
    const arr = [1, 2, 3, 4, 5];
    let sibling = hashUint256Array(arr.slice(0, 2), 0); // Sibling is hash of [1, 2]
    let result = await hashContract.testToHashArray(arr.slice(2, 5), sibling);
    assert(result === hashUint256Array(arr, 0), 'Array hash with sibling does not matched');
  });
});
