import ethUtils from 'ethereumjs-util';

export function getUnbalancedMerkleProof (arr) {
  let result = null;
  for (let index = arr.length - 1; index >= 0; index--) {
    const element = ethUtils.setLengthLeft(ethUtils.toBuffer(arr[index]), 32);
    if (result !== null) {
      result = ethUtils.keccak256(Buffer.concat([element, result]));
    } else {
      result = ethUtils.keccak256(element);
    }
  }

  return ethUtils.bufferToHex(result);
}
