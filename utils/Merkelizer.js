const ethers = require('ethers');

const AbstractMerkleTree = require('./AbstractMerkleTree');
const { ZERO_HASH } = require('./constants');

module.exports = class Merkelizer extends AbstractMerkleTree {
  static initialStateHash (code, callData, customEnvironmentHash) {
    const DEFAULT_GAS = 0x0fffffffffffff;
    const res = {
      executionState: {
        code: code,
        data: callData,
        compactStack: [],
        stack: [],
        mem: [],
        returnData: '0x',
        pc: 0,
        errno: 0,
        gasRemaining: DEFAULT_GAS,
        stackSize: 0,
        memSize: 0,
        customEnvironmentHash: customEnvironmentHash || ZERO_HASH,
      },
    };

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
    const fragments = [];
    for (let pos = 0; pos < code.length; pos += 64) {
      fragments.push(code.slice(pos, pos + 64));
    }
    if (fragments[fragments.length - 1].length < 64) {
      fragments[fragments.length - 1] += '0'.repeat(64 - fragments[fragments.length - 1].length);
    }

    let tree = [[]];
    tree[0] = fragments.map(x => ethers.utils.solidityKeccak256(['bytes32'], [`0x${x}`]));
    let stage = 0;
    while (tree[stage].length > 1) {
      let next = stage + 1;
      tree.push([]);
      if (tree[stage].length % 2 === 1) tree[stage].push(ZERO_HASH);
      for (let pos = 0; pos < tree[stage].length; pos += 2) {
        tree[next].push(
          ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [tree[stage][pos], tree[stage][pos + 1]])
        );
      }
      stage++;
    }
    return tree[stage][0];
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
