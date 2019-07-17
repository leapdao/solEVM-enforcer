'use strict';

const ethers = require('ethers');
const createKeccakHash = require('keccak');

const AbstractMerkleTree = require('./AbstractMerkleTree');
const { ZERO_HASH } = require('./constants');

module.exports = class Merkelizer extends AbstractMerkleTree {
  /// @notice If the first (left-most) hash is not the same as this,
  /// then the solution from that player is invalid.
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
        customEnvironmentHash: customEnvironmentHash,
        stackHash: this.stackHash([]),
        memHash: this.memHash([]),
        dataHash: this.dataHash(callData),
      },
    };

    res.hash = this.stateHash(res.executionState);

    return res;
  }

  static stackHashes (stack, sibling) {
    const res = sibling || ZERO_HASH;
    const hashes = [res];
    const len = stack.length;

    if (len === 0) {
      return hashes;
    }

    // could be further improved by a custom keccak implementation
    const hash = createKeccakHash('keccak256');

    hash.update(Buffer.from(res.replace('0x', ''), 'hex'));
    for (let i = 0; i < len; i++) {
      const val = Buffer.from(stack[i].replace('0x', ''), 'hex');

      hash.update(val);

      if (i !== len - 1) {
        const buf = hash.digest();
        hashes.push(`0x${buf.toString('hex')}`);
        hash._finalized = false;
        hash.update(buf);
      }
    }

    hashes.push(`0x${hash.digest().toString('hex')}`);
    return hashes;
  }

  static stackHash (stack, sibling) {
    const res = this.stackHashes(stack, sibling);
    return res[res.length - 1];
  }

  static memHash (mem) {
    const len = mem.length;
    const hash = createKeccakHash('keccak256');

    for (let i = 0; i < len; i++) {
      hash.update(Buffer.from(mem[i].replace('0x', ''), 'hex'));
    }

    return `0x${hash.digest().toString('hex')}`;
  }

  static dataHash (data) {
    return ethers.utils.solidityKeccak256(
      ['bytes'],
      [data]
    );
  }

  static preStateHash (execution) {
    return ethers.utils.solidityKeccak256(
      [
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
      ],
      [
        execution.stackHash,
        execution.memHash,
        execution.dataHash,
        execution.customEnvironmentHash,
        execution.pc,
        execution.gasRemaining,
        execution.stackSize,
        execution.memSize,
      ]
    );
  }

  static stateHash (execution) {
    // TODO: compact returnData

    return ethers.utils.solidityKeccak256(
      [
        'bytes32',
        'bytes',
      ],
      [
        this.preStateHash(execution),
        execution.returnData,
      ]
    );
  }

  run (executions, code, callData, customEnvironmentHash) {
    if (!executions || !executions.length) {
      throw new Error('You need to pass at least one execution step');
    }
    customEnvironmentHash = customEnvironmentHash || ZERO_HASH;

    this.tree = [[]];

    const initialState = this.constructor.initialStateHash(code, callData, customEnvironmentHash);
    const leaves = this.tree[0];
    const callDataHash = this.constructor.dataHash(callData);

    let prevLeaf = { right: initialState };
    let len = executions.length;
    let memHash;

    for (let i = 0; i < len; i++) {
      const exec = executions[i];
      const stackHash = exec.stackHash;

      // memory is changed if either written to or if it was expanded
      let memoryChanged = exec.memWriteLow !== -1;
      if (!memoryChanged && prevLeaf.right.executionState) {
        memoryChanged = prevLeaf.right.executionState.memSize !== exec.memSize;
      }

      if (!memHash || memoryChanged) {
        memHash = this.constructor.memHash(exec.mem);
      }

      // convenience
      exec.memSize = exec.mem.length;
      exec.data = callData;
      exec.dataHash = callDataHash;
      exec.memHash = memHash;
      // TODO: the runtime should ultimately support and supply that
      exec.customEnvironmentHash = customEnvironmentHash;

      const hash = this.constructor.stateHash(exec);
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

  /// @notice Calculates a proof for `returnData` of the last execution step.
  /// @return Array
  computeResultProof () {
    const resultProof = [];

    let returnData;
    let node = this.root;
    while (true) {
      let hash = node.right.hash;

      if (node.isLeaf) {
        if (node.right.hash === ZERO_HASH) {
          const preHash = this.constructor.preStateHash(node.left.executionState);

          returnData = node.left.executionState.returnData;
          resultProof.push(preHash);
          resultProof.push(node.right.hash);
        } else {
          const preHash = this.constructor.preStateHash(node.right.executionState);

          returnData = node.right.executionState.returnData;
          resultProof.push(node.left.hash);
          resultProof.push(preHash);
        }
        break;
      }

      resultProof.push(node.left.hash);
      resultProof.push(node.right.hash);

      if (hash === ZERO_HASH) {
        hash = node.left.hash;
      }
      node = this.getNode(hash);
    }

    return { resultProof, returnData };
  }

  /// @notice Verifies a proof from `computeResultProof`.
  /// @return `true` if correct, else `false`
  verifyResultProof (resultProof, returnData, rootHash) {
    const len = resultProof.length;

    if (len < 2 || (len % 2) !== 0) {
      return false;
    }

    // save those temporarily
    let tmpLeft = resultProof[len - 2];
    let tmpRight = resultProof[len - 1];
    if (tmpRight === ZERO_HASH) {
      resultProof[len - 2] =
        ethers.utils.solidityKeccak256(['bytes32', 'bytes'], [tmpLeft, returnData]);
    } else {
      resultProof[len - 1] =
        ethers.utils.solidityKeccak256(['bytes32', 'bytes'], [tmpRight, returnData]);
    }

    let valid = true;
    let parentHash = rootHash;
    for (let i = 0; i < len; i += 2) {
      const left = resultProof[i];
      const right = resultProof[i + 1];
      const hash = this.constructor.hash(left, right);

      if (hash !== parentHash) {
        valid = false;
        break;
      }

      if (right === ZERO_HASH) {
        parentHash = left;
      } else {
        parentHash = right;
      }
    }

    // restore the values we swapped above
    resultProof[len - 2] = tmpLeft;
    resultProof[len - 1] = tmpRight;

    return valid;
  }
};
