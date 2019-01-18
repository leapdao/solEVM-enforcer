import { hashUint256Array, hashSibling, hashStack } from './helpers/hash';
import { deployContract } from './utils.js';
import { ethers } from 'ethers';

const HashMock = artifacts.require('HashMock.sol');
const HashZero = ethers.constants.HashZero;

contract('TestHash', function () {
  let hashContract;
  before(async () => {
    hashContract = await deployContract(HashMock);
  });

  it('correctly calculate hash of array', async function () {
    const arr = [1, 2, 3];
    let result = await hashContract.hashArray(arr);
    assert(result === hashUint256Array(arr, 3, HashZero), 'Array hash does not matched');
  });

  it('correctly calculate hash of array with sibling', async function () {
    const arr = [1, 2, 3, 4, 5];
    let sibling = hashSibling(arr.slice(0, 2)); // Sibling is hash of [1, 2]
    let result = await hashContract.hashArrayWithSibling(arr.slice(2, 5), 5, sibling);
    assert(result === hashUint256Array(arr, 5, HashZero), 'Array hash with sibling does not matched');
  });

  it('correctly hash array with different length to different hash', async function () {
    const arr = [1, 2, 3, 4, 5];
    let sibling = hashSibling(arr.slice(0, 2)); // Sibling is hash of [1, 2]
    let result1 = await hashContract.hashArrayWithSibling(arr.slice(2, 5), 5, sibling);
    let result2 = await hashContract.hashArrayWithSibling(arr.slice(2, 5), 6, sibling);
    assert(result1 !== result2, 'Hash result should not matched');
  });

  it('hash of stack is match hash of array', async function () {
    const arr = [1, 2, 3, 4, 5];
    const stack = {
      size: 5,
      data: [1, 2, 3, 4, 5],
      dataLength: 5,
      sibling: HashZero,
    };
    let resultArr = hashUint256Array(arr, 5, HashZero);
    let resultStack = hashStack(stack);
    assert(resultArr === resultStack, 'Hash of stack not match array');
  });
});
