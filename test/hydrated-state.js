import ethUtils from 'ethereumjs-util';
import { getUnbalancedMerkleProof } from './helpers/unbalanced-merkle';

const EthereumRuntime = artifacts.require('EthereumRuntime');
const Hydrated = artifacts.require('Hydrated');

function getSibling (val) {
  return ethUtils.bufferToHex(ethUtils.keccak256(ethUtils.setLengthLeft(ethUtils.toBuffer(val), 32)));
}

contract('Hydrated', function () {
  let ethereumRuntime;
  let hydratedContract;

  before(async function () {
    ethereumRuntime = await EthereumRuntime.new();
    hydratedContract = await Hydrated.new(ethereumRuntime.address);
  });

  it('should allow to prove ADD operation on-chain', async function () {
    let status = await hydratedContract.proveArithmeticOperation(
      '0x01', // ADD
      getUnbalancedMerkleProof([5, 8, 12]),
      getUnbalancedMerkleProof([13, 12]),
      [5, 8],
      getSibling(12)
    );
    assert.equal(status, true);

    // without sibling
    status = await hydratedContract.proveArithmeticOperation(
      '0x01', // ADD
      getUnbalancedMerkleProof([5, 8]),
      getUnbalancedMerkleProof([13]),
      [5, 8],
      '0x0'
    );
    assert.equal(status, true);

    // with sibling
    status = await hydratedContract.proveArithmeticOperation(
      '0x01', // ADD
      getUnbalancedMerkleProof([5, 45, 78, 1234896, 45, 100033, 354372]),
      getUnbalancedMerkleProof([50, 78, 1234896, 45, 100033, 354372]),
      [5, 45],
      getUnbalancedMerkleProof([78, 1234896, 45, 100033, 354372])
    );
    assert.equal(status, true);
  });

  it('should allow to prove MULT operation on-chain', async function () {
    let status = await hydratedContract.proveArithmeticOperation(
      '0x02', // MUL
      getUnbalancedMerkleProof([5, 8, 89]),
      getUnbalancedMerkleProof([40, 89]),
      [5, 8],
      getSibling(89)
    );
    assert.equal(status, true);

    // without sibling
    status = await hydratedContract.proveArithmeticOperation(
      '0x02', // MUL
      getUnbalancedMerkleProof([5, 8]),
      getUnbalancedMerkleProof([40]),
      [5, 8],
      '0x0'
    );
    assert.equal(status, true);
  });
});
