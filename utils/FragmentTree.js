'use strict';

const ethers = require('ethers');

const AbstractMerkleTree = require('./AbstractMerkleTree');

// We should support compressed proofs in the future,
// means re-using hashes if we construct a proof for more than 1 slot.
module.exports = class FragmentTree extends AbstractMerkleTree {
  /// @dev return hash proof for `slot`,
  /// `slot` is position in `this.leaves`.
  /// @return proof - array of 32 bytes hex-string (hashes)
  calculateProof (slot) {
    const proof = [];
    const len = this.depth - 1;

    for (let i = 0; i < len; i++) {
      proof.push(this.tree[i][slot ^ 1].hash);
      slot >>= 1;
    }
    return proof;
  }

  /// @dev verify if given `proofs` and `leaf` match `this.root.hash`
  verifyProof (leaf, proofs) {
    const len = proofs.length;
    let hash = leaf.hash;
    let slot = leaf.slot;

    for (let i = 0; i < len; i++) {
      const proof = proofs[i];

      if (slot % 2 === 0) {
        hash = this.constructor.hash(hash, proof);
      } else {
        hash = this.constructor.hash(proof, hash);
      }
      slot >>= 1;
    }

    return hash === this.root.hash;
  }

  /// @notice build the tree for the given hex-string `data`.
  /// @dev `data` will be splited into fragments and padded to one word (32 bytes).
  run (data) {
    data = data.replace('0x', '');

    this.tree = [[]];

    const leaves = this.tree[0];
    const byteLength = data.length / 2;
    const len = data.length;
    let slot = 0;

    for (let i = 0; i < len;) {
      const value = '0x' + data.substring(i, i += 64).padEnd(64, '0');
      const hash = ethers.utils.solidityKeccak256(
        ['bytes32', 'uint256', 'uint256'],
        [value, slot, byteLength]
      );

      slot = leaves.push({ hash, value, slot, byteLength });
    }

    this.recal(0);

    return this;
  }
};
