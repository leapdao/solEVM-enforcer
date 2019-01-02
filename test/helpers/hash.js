import { ethers } from 'ethers';

/*
 * This hash function hashes an array with a sibling element
 */
export function hashUint256Array (arr, sibling) {
  let hash = ethers.utils.defaultAbiCoder.encode(['uint256'], [sibling]);
  let encodePacked;
  for (let index = 0; index < arr.length; index++) {
    let element = ethers.utils.defaultAbiCoder.encode(['uint256'], [arr[index]]);
    encodePacked = ethers.utils.defaultAbiCoder.encode(['bytes32', 'bytes32'], [hash, element]);
    hash = ethers.utils.keccak256(encodePacked);
  }
  return hash;
}
