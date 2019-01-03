
const ethers = require('ethers');
const EMPTY_STATE = '0x0000000000000000000000000000000000000000000000000000000000000000';

export default class Merkelizer {
  static getEmptyState (callData) {
    const DEFAULT_GAS = 0x0fffffffffffff;
    const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
    const res = {
      hash: EMPTY_STATE,
      executionState: {
        input: {
          data: callData,
          compactStack: [],
          stack: [],
          mem: '',
          returnData: '',
          logHash: ZERO_HASH,
          pc: 0,
          gasRemaining: DEFAULT_GAS,
        },
        output: {
          data: callData,
          compactStack: [],
          stack: [],
          mem: '',
          returnData: '',
          logHash: ZERO_HASH,
          pc: 0,
          errno: 0,
          gasRemaining: DEFAULT_GAS,
        },
      },
    };

    // Note:
    //   This value needs to be taken into account for the dispute logic (timeout function).
    //   If the first (left-most) hash is not the same as this,
    //   then the solution from that player is invalid
    res.hash = this.stateHash(res.executionState.output);

    return res;
  }

  static hash (left, right) {
    return ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes32'],
      [left, right]
    );
  }

  static codeHash (code) {
    return ethers.utils.solidityKeccak256(
      ['bytes'],
      ['0x' + code.join('')]
    );
  }

  static stackHash (stack, sibling) {
    let res = sibling || EMPTY_STATE;

    for (var i = 0; i < stack.length; i++) {
      let h = ethers.utils.solidityKeccak256(
        ['uint'],
        ['0x' + stack[i]]
      );
      res = this.hash(res, h);
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

  static stateHash (execution, stackHash, memHash, dataHash) {
    // TODO: implement support for accounts
    // TODO: compact-{code, returnData, accounts}

    if (!stackHash) {
      stackHash = this.stackHash(execution.stack);
    }

    if (!memHash) {
      memHash = this.memHash(execution.mem);
    }

    if (!dataHash) {
      dataHash = this.dataHash(execution.data);
    }

    return ethers.utils.solidityKeccak256(
      ['bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'uint', 'uint'],
      [
        stackHash,
        memHash,
        dataHash,
        '0x' + execution.logHash,
        '0x' + execution.returnData,
        execution.pc,
        execution.gasRemaining,
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
    // we do not count the leaves
    return this.tree.length - 1;
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

  run (executions) {
    if (!executions || !executions.length) {
      throw new Error('You need to pass at least one execution step');
    }

    this.tree = [[]];

    const firstExecutionStep = executions[0];
    const emptyState = this.constructor.getEmptyState(firstExecutionStep.input.data);
    const leaves = this.tree[0];

    while (executions.length % 2 !== 0) {
      executions.push(emptyState.executionState);
    }

    let prevLeaf = { left: emptyState, right: emptyState };
    let len = executions.length;

    for (let i = 0; i < len; i++) {
      let hash = this.constructor.stateHash(executions[i].output);
      let llen = leaves.push(
        {
          left: prevLeaf.right,
          right: {
            hash: hash,
            executionState: executions[i],
          },
          hash: this.constructor.hash(prevLeaf.right.hash, hash),
          isLeaf: true,
        }
      );

      prevLeaf = leaves[llen - 1];
    }

    let level = 1;
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
              hash: EMPTY_STATE,
            },
            right: {
              hash: EMPTY_STATE,
            },
            hash: EMPTY_STATE,
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

    return this;
  }

  printTree () {
    for (let i = 0; i < this.tree.length; i++) {
      let row = this.tree[i];
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
}
