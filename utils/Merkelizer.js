'use strict';

const ethers = require('ethers');
const createKeccakHash = require('keccak');

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
        customEnvironmentHash: customEnvironmentHash,
      },
    };

    // Note:
    //   This value needs to be taken into account for the dispute logic (timeout function).
    //   If the first (left-most) hash is not the same as this,
    //   then the solution from that player is invalid

    const stackHash = this.stackHash([]);
    const memHash = this.memHash([]);
    const callDataHash = this.dataHash(callData);

    res.hash = this.stateHash(
      res.executionState,
      stackHash,
      memHash,
      callDataHash,
      customEnvironmentHash
    );

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

  static stateHash (execution, stackHash, memHash, dataHash, customEnvironmentHash) {
    // TODO: compact returnData

    return ethers.utils.solidityKeccak256(
      [
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes32',
        'bytes',
        'uint256',
        'uint256',
        'uint256',
        'uint256'],
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

      // convenience
      exec.memSize = exec.mem.length;
      exec.data = callData;
      // TODO: the runtime should ultimately support and supply that
      exec.customEnvironmentHash = customEnvironmentHash;

      // memory is changed if either written to or if it was expanded
      let memoryChanged = exec.memWriteLow !== -1;
      if (!memoryChanged && prevLeaf.right.executionState) {
        memoryChanged = prevLeaf.right.executionState.memSize !== exec.memSize;
      }

      if (!memHash || memoryChanged) {
        memHash = this.constructor.memHash(exec.mem);
      }

      const hash = this.constructor.stateHash(exec, stackHash, memHash, callDataHash, customEnvironmentHash);
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
