import { ethers } from 'ethers';

export function hashSibling (arr) {
  let hash = ethers.constants.HashZero;
  for (let index = 0; index < arr.length; index++) {
    hash = ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [hash, arr[index]]);
  }
  return hash;
}

/*
 * This hash function hashes an array with a sibling element
 */
export function hashUint256Array (arr, size, sibling) {
  let hash = sibling;
  for (let index = 0; index < arr.length; index++) {
    hash = ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [hash, arr[index]]);
  }
  hash = ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [hash, size]);
  return hash;
}

/*
 * This hash function hash a stack struct
 * The struct is suppose to mimic CompactEVMStack
 */
export function hashStack (stack) {
  let hash = stack.sibling;
  for (let index = 0; index < stack.dataLength; index++) {
    hash = ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [hash, stack.data[index]]);
  }
  hash = ethers.utils.solidityKeccak256(['bytes32', 'uint256'], [hash, stack.size]);
  return hash;
}
