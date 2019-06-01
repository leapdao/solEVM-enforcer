const ethers = require('ethers');
const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

module.exports = class Merkelizer {
  static initialStateHash (code, callData, customEnvironmentHash) {
    const DEFAULT_GAS = 0x0fffffffffffff;
    const res = {
      executionState: {
        code: code,
        data: callData.replace('0x', ''),
        compactStack: [],
        stack: [],
        mem: '',
        returnData: '',
        pc: 0,
        errno: 0,
        gasRemaining: DEFAULT_GAS,
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

  static zero () {
    return {
      left: {
        hash: ZERO_HASH,
      },
      right: {
        hash: ZERO_HASH,
      },
      hash: ZERO_HASH,
    };
  }

  static hash (left, right) {
    return ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [left, right]
    );
  }

  static stackHash (stack, sibling) {
    let res = sibling || ZERO_HASH;

    for (var i = 0; i < stack.length; i++) {
      res = ethers.utils.solidityKeccak256(
        ['bytes32', 'uint'],
        [res, stack[i]]
      );
    }

    return res;
  }

  static memHash (mem) {
    return ethers.utils.solidityKeccak256(
      ['bytes'],
      ['0x' + mem]
    );
  }

  static dataHash (data) {
    return ethers.utils.solidityKeccak256(
      ['bytes'],
      ['0x' + data]
    );
  }

  static stateHash (execution, stackHash, memHash, dataHash, customEnvironmentHash) {
    // TODO: compact returnData

    if (!stackHash) {
      stackHash = this.stackHash(execution.stack);
    }

    if (!memHash) {
      memHash = this.memHash(execution.mem);
    }

    if (!dataHash) {
      dataHash = this.dataHash(execution.data);
    }

    if (!customEnvironmentHash) {
      customEnvironmentHash = ZERO_HASH;
    }

    return ethers.utils.solidityKeccak256(
      ['bytes', 'bytes', 'bytes', 'bytes', 'uint', 'uint', 'bytes32'],
      [
        stackHash,
        memHash,
        dataHash,
        '0x' + execution.returnData,
        execution.pc,
        execution.gasRemaining,
        customEnvironmentHash,
      ]
    );
  }

  constructor () {
    this.tree = [];
  }

  get root () {
    return this.tree[this.tree.length - 1][0];
  }

  get depth () {
    // we also count leaves
    return this.tree.length;
  }

  getNode (hash) {
    let len = this.tree.length;

    while (len--) {
      let x = this.tree[len];

      let iLen = x.length;
      while (iLen--) {
        let y = x[iLen];
        if (y.hash === hash) {
          return y;
        }
      }
    }

    return null;
  }

  getPair (leftHash, rightHash) {
    let len = this.tree.length;

    while (len--) {
      let x = this.tree[len];

      let iLen = x.length;
      while (iLen--) {
        let y = x[iLen];
        if (y.left.hash === leftHash && y.right.hash === rightHash) {
          return y;
        }
      }
    }

    return null;
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

    for (let i = 0; i < len; i++) {
      let exec = executions[i];
      let hash = this.constructor.stateHash(exec);
      let llen = leaves.push(
        {
          left: prevLeaf.right,
          right: {
            hash: hash,
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

  recal (baseLevel) {
    if (baseLevel === undefined) {
      baseLevel = 0;
    }
    let level = baseLevel + 1;
    // clear everything from level and above
    this.tree = this.tree.slice(0, level);
    while (true) {
      let last = this.tree[level - 1];
      let cur = [];

      if (last.length === 1) {
        // done
        break;
      }

      let len = last.length;
      for (let i = 0; i < len; i += 2) {
        let left = last[i];
        let right = last[i + 1];

        if (!right) {
          right = {
            left: {
              hash: ZERO_HASH,
            },
            right: {
              hash: ZERO_HASH,
            },
            hash: ZERO_HASH,
          };
          last.push(right);
        }

        cur.push(
          {
            left: left,
            right: right,
            hash: this.constructor.hash(left.hash, right.hash),
          }
        );
      }

      this.tree.push(cur);
      level++;
    }
  }

  printTree () {
    for (let i = 0; i < this.tree.length; i++) {
      let row = this.tree[i];
      process.stdout.write(`level ${i}: `);
      for (let y = 0; y < row.length; y++) {
        let e = row[y];
        const h = e.hash.substring(2, 6);
        const hl = e.left.hash.substring(2, 6);
        const hr = e.right.hash.substring(2, 6);
        process.stdout.write(` [ ${h} (l:${hl} r:${hr}) ] `);
      }
      process.stdout.write('\n');
    }
  }
};
