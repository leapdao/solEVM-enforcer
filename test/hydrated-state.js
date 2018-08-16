import ethUtils from 'ethereumjs-util';
import { getUnbalancedMerkleProof } from './helpers/unbalanced-merkle';

const Hydrated = artifacts.require('Hydrated.sol');

contract('Hydrated', function () {
  it('should allow to prove ADD operation on-chain', async function () {
    const contract = await Hydrated.new();
    let beforeStack = [5, 8, 12];
    let afterStack = [13, 12];

    let beforeHash = getUnbalancedMerkleProof(beforeStack);
    let afterHash = getUnbalancedMerkleProof(afterStack);
    let status = await contract.proveAddOperation(
      beforeHash,
      afterHash,
      [5, 8],
      ethUtils.bufferToHex(ethUtils.keccak256(ethUtils.setLengthLeft(ethUtils.toBuffer(12), 32))),
      true
    );
    assert.equal(status, true);
  });
});
