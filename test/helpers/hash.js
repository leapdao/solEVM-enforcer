import ethUtils from 'ethereumjs-util';
export function getHash(arr, sibling) {
  let result = ethUtils.setLengthLeft(ethUtils.toBuffer(sibling), 32);
  for (let index = 0; index < arr.length; index++) {
    const element = ethUtils.setLengthLeft(ethUtils.toBuffer(arr[index]), 32);
      result = ethUtils.keccak256(Buffer.concat([result, element]));
  }
  return ethUtils.bufferToHex(result);
}

