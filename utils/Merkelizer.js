const ethers = require('ethers');
const OffchainStepper = require('./OffchainStepper');

const AbstractMerkleTree = require('./AbstractMerkleTree');
const { ZERO_HASH } = require('./constants');

module.exports = class Merkelizer extends AbstractMerkleTree {
  static initialStateHash (code, callData, customEnvironmentHash) {
    let res = OffchainStepper.initialState(code, callData, customEnvironmentHash);
    // Note:
    //   This value needs to be taken into account for the dispute logic (timeout function).
    //   If the first (left-most) hash is not the same as this,
    //   then the solution from that player is invalid
    res.hash = this.stateHash(res.executionState);

    return res;
  }

  static emptyRawCode () {
    let res = [];
    for (let i = 0; i < 50; i++) {
      res.push({ pos: 0, value: 0 });
    }
    return res;
  }

  /**
   * @dev return Merkle hash root of code
   *    - split code string into words
   *    - each words correspond to a leaf
   *    - calculate Merkle root, stub zero_hash when needed
   *
   * @param code string
   */
  static codeHash (code) {
    // split code to 64 char string - bytes32
    const fragments = Merkelizer.fragmentCode(code);
    const merkle = Merkelizer.generateMerkleTree(fragments);

    return merkle.tree[merkle.depth - 1][0];
  }

  /**
   * divide code in to fragments of bytes32, last element is padded
   * code is a hex string
   */
  static fragmentCode (code) {
    console.log('FRAGMENT');
    const fragments = [];
    for (let pos = 0; pos < code.length; pos += 64) {
      fragments.push(code.slice(pos, pos + 64));
    }
    if (fragments[fragments.length - 1].length < 64) {
      fragments[fragments.length - 1] += '0'.repeat(64 - fragments[fragments.length - 1].length);
    }
    return fragments;
  }

  /**
   * @dev return the Merkle tree generated for a given array of values
   */
  static generateMerkleTree (arr) {
    console.log('GENERATING', arr);
    let merkle = {
      depth: 0,
      tree: [[]],
    };
    merkle.tree[0] = arr.map(x => ethers.utils.solidityKeccak256(['bytes32'], [`0x${x}`]));
    let depth = 0;
    while (merkle.tree[depth].length > 1) {
      let next = depth + 1;
      merkle.tree.push([]);
      if (merkle.tree[depth].length % 2 === 1) merkle.tree[depth].push(ZERO_HASH);
      for (let pos = 0; pos < merkle.tree[depth].length; pos += 2) {
        merkle.tree[next].push(
          ethers.utils.solidityKeccak256(
            ['bytes32', 'bytes32'],
            [merkle.tree[depth][pos], merkle.tree[depth][pos + 1]])
        );
      }
      depth++;
    }
    merkle.depth = depth + 1;
    return merkle;
  }

  /**
   * @dev return hash proof that an element exists in arr at pos
   *  - pos is position in arr
   *  - arr is an array of values
   *  - proof is of the form { pos: p, hashes: [ h, ... ] }
   */
  static hashProof (pos, arr) {
    console.log('Getting proof', pos, arr);
    let merkle = Merkelizer.generateMerkleTree(arr);
    console.log('Merkle', merkle);
    const proof = {
      pos: pos,
      hashes: [],
    };
    let p = pos;
    for (let i = 0; i < merkle.depth - 1; i++) {
      proof.hashes.push(merkle.tree[i][p ^ (p % 2)]);
      p >>= 1;
    }
    return proof;
  }

  static stackHash (stack, sibling) {
    let res = sibling || ZERO_HASH;

    for (var i = 0; i < stack.length; i++) {
      res = ethers.utils.solidityKeccak256(
        ['bytes32', 'bytes32'],
        [res, stack[i]]
      );
    }

    return res;
  }

  static memHash (mem) {
    return ethers.utils.solidityKeccak256(
      ['bytes32[]'],
      [mem]
    );
  }

  static dataHash (data) {
    return ethers.utils.solidityKeccak256(
      ['bytes'],
      [data]
    );
  }

  static stateHash (execution, stackHash, memHash, dataHash, customEnvironmentHash) {
    // TODO: compact returnData

    if (!stackHash || stackHash === ZERO_HASH) {
      stackHash = this.stackHash(execution.stack);
    }

    if (!memHash || memHash === ZERO_HASH) {
      memHash = this.memHash(execution.mem);
    }

    if (!dataHash || dataHash === ZERO_HASH) {
      dataHash = this.dataHash(execution.data);
    }

    if (!customEnvironmentHash) {
      customEnvironmentHash = ZERO_HASH;
    }

    return ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'bytes32', 'bytes', 'uint', 'uint', 'uint', 'uint'],
      [
        stackHash,
        memHash,
        dataHash,
        customEnvironmentHash,
        execution.returnData,
        execution.pc,
        execution.gasRemaining,
        execution.stackSize,
        execution.memSize,
      ]
    );
  }

  run (executions, code, callData, customEnvironmentHash) {
    if (!executions || !executions.length) {
      throw new Error('You need to pass at least one execution step');
    }

    this.tree = [[]];

    const initialState = this.constructor.initialStateHash(code, callData, customEnvironmentHash);
    const leaves = this.tree[0];

    let prevLeaf = { right: initialState };
    let len = executions.length;
    let memHash;

    for (let i = 0; i < len; i++) {
      const exec = executions[i];
      const stackHash = this.constructor.stackHash(exec.stack);

      // convenience
      exec.stackSize = exec.stack.length;
      exec.memSize = exec.mem.length;

      // memory is changed if either written to or if it was expanded
      let memoryChanged = exec.memWriteLow !== -1;
      if (!memoryChanged && prevLeaf.right.executionState) {
        memoryChanged = prevLeaf.right.executionState.memSize !== exec.memSize;
      }

      if (!memHash || memoryChanged) {
        memHash = this.constructor.memHash(exec.mem) || ZERO_HASH;
      }

      const hash = this.constructor.stateHash(exec, stackHash, memHash);
      const llen = leaves.push(
        {
          left: prevLeaf.right,
          right: {
            hash: hash,
            stackHash,
            memHash,
            executionState: executions[i],
          },
          hash: this.constructor.hash(prevLeaf.right.hash, hash),
          isLeaf: true,
          isFirstExecutionStep: i === 0,
        }
      );

      prevLeaf = leaves[llen - 1];
    }

    this.recal(0);

    return this;
  }
};
