'use strict';

const Merkelizer = require('./Merkelizer');

const { ZERO_HASH } = require('./constants');

module.exports = class ProofHelper {
  static constructProof (computationPath, { merkle, codeFragmentTree }) {
    const prevOutput = computationPath.left.executionState;
    const execState = computationPath.right.executionState;
    const proofs = {
      stackHash: Merkelizer.stackHash(
        prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
      ),
      memHash: execState.isMemoryRequired ? ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
      dataHash: execState.isCallDataRequired ? ZERO_HASH : Merkelizer.dataHash(prevOutput.data),
      codeByteLength: 0,
      codeFragments: [],
      codeProof: [],
    };

    if (codeFragmentTree) {
      const leaves = codeFragmentTree.leaves;
      const neededSlots = [];

      // convert to 32 byte-sized words
      execState.codeReads.forEach(
        function (val) {
          val = val >> 5;
          if (neededSlots.indexOf(val) === -1) {
            neededSlots.push(val);
          }
        }
      );

      for (let i = 0; i < neededSlots.length; i++) {
        const slot = neededSlots[i];
        const leaf = leaves[slot];

        if (leaf.hash === ZERO_HASH) {
          continue;
        }
        // panic, just in case
        if (leaf.slot !== slot) {
          throw new Error('FragmentTree for contract code is not sorted');
        }

        proofs.codeFragments.push('0x' + leaf.slot.toString(16).padStart(64, '0'));
        proofs.codeFragments.push(leaf.value);

        const proof = codeFragmentTree.calculateProof(leaf.slot);
        // paranoia
        if (!codeFragmentTree.verifyProof(leaf, proof)) {
          throw new Error(`Can not verify proof for ${leaf}`);
        }

        proofs.codeProof = proofs.codeProof.concat(proof);
        proofs.codeByteLength = leaf.byteLength;
      }
    }

    return {
      proofs,
      executionInput: {
        data: (execState.isCallDataRequired ? prevOutput.data : '0x'),
        stack: execState.compactStack,
        mem: execState.isMemoryRequired ? prevOutput.mem : [],
        customEnvironmentHash: ZERO_HASH,
        returnData: prevOutput.returnData,
        pc: prevOutput.pc,
        gasRemaining: prevOutput.gasRemaining,
        stackSize: prevOutput.stackSize,
        memSize: prevOutput.memSize,
      },
    };
  }
};
