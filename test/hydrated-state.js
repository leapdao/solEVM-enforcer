import ethUtils from 'ethereumjs-util';
import { getUnbalancedMerkleProof } from './helpers/unbalanced-merkle';

const EthereumRuntime = artifacts.require('EthereumRuntime');
const Hydrated = artifacts.require('Hydrated');

contract('Hydrated', function () {
  let ethereumRuntime;
  let hydratedContract;

  before(async function () {
    ethereumRuntime = await EthereumRuntime.new();
    hydratedContract = await Hydrated.new(ethereumRuntime.address);
  });

  it('should allow to prove ADD operation on-chain', async function () {
    let beforeStack = [5, 8, 12];
    let afterStack = [13, 12];

    let beforeHash = getUnbalancedMerkleProof(beforeStack);
    let afterHash = getUnbalancedMerkleProof(afterStack);
    let status = await hydratedContract.proveArithmeticOperation(
      '0x01', // ADD
      beforeHash,
      afterHash,
      [5, 8],
      ethUtils.bufferToHex(ethUtils.keccak256(ethUtils.setLengthLeft(ethUtils.toBuffer(12), 32))),
      true
    );
    assert.equal(status, true);
  });
});
