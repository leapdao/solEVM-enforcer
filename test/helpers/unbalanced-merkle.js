import ethUtils from 'ethereumjs-util';

export function getUnbalancedMerkleProof (arr) {
  let result = null;
  if (arr.length === 1) {
    return ethUtils.keccak256(ethUtils.toBuffer(arr[0]));
  }

  for (let index = arr.length - 1; index >= 0; index--) {
    const element = ethUtils.toBuffer(arr[index]);
    const elementArray = [element];
    if (result !== null) {
      elementArray.push(result);
    }

    result = ethUtils.keccak256(Buffer.concat(elementArray));
  }

  return ethUtils.bufferToHex(result);
}
