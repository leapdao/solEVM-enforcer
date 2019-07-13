'use strict';

const assert = require('assert');
const { randomFillSync } = require('crypto');

const { FragmentTree } = require('./../../utils');

function randomString (size) {
  return `0x${randomFillSync(Buffer.alloc(size)).toString('hex')}`;
}

describe('FragmentTree', function () {
  for (let i = 1; i < 1024; i++) {
    it(`Loop #${i}`, () => {
      const bytecode = randomString(i);
      const byteLength = (bytecode.length - 2) / 2;
      const tree = new FragmentTree().run(bytecode);
      const slots = ~~((i + 31) / 32);

      for (let x = 0; x < slots; x++) {
        const leaf = tree.leaves[x];
        const startOffset = (x * 64) + 2;
        const value = bytecode.substring(startOffset, startOffset + 64).padEnd(64, '0');

        assert.equal(leaf.slot, x, 'slot should match');
        assert.equal(leaf.byteLength, byteLength, 'byteLength should match');
        assert.equal(leaf.value, `0x${value}`, 'value should match');
      }

      assert.equal(tree.leaves.length, slots + slots % 2, 'number of leaves should match');

      const proof = tree.calculateProof(slots - 1);
      assert.ok(tree.verifyProof(tree.leaves[slots - 1], proof), 'verifyProof');
    });
  }
});
