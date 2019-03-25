
const VM = require('ethereumjs-vm');
const BN = VM.deps.ethUtil.BN;
const ethers = require('ethers');
const OP = require('./constants');

const toHex = arr => arr.map(e => '0x' + e.toString(16));
const MEMORY_OPCODES =
  [
    'SHA3',
    'MLOAD',
    'MSIZE',
    'LOG0',
    'LOG1',
    'LOG2',
    'LOG3',
    'LOG4',
    'CREATE',
    'CREATE2',
    'CALL',
    'RETURN',
    'DELEGATECALL',
    'STATICCALL',
    'REVERT',
    'CALLDATACOPY',
    'CODECOPY',
    'CALLCODE',
    'EXTCODECOPY',
    'RETURNDATACOPY',
    'MSTORE',
    'MSTORE8',
  ];

// Supported by ethereumjs-vm
const ERRNO_MAP =
  {
    'stack overflow': 0x01,
    'stack underflow': 0x02,
    'invalid opcode': 0x04,
    'invalid JUMP': 0x05,
    'instruction not supported': 0x06,
    'revert': 0x07,
    'static state change': 0x0b,
    'out of gas': 0x0d,
    'internal error': 0xff,
  };

const ERROR = {
  OUT_OF_GAS: 'out of gas',
  STACK_UNDERFLOW: 'stack underflow',
  STACK_OVERFLOW: 'stack overflow',
  INVALID_JUMP: 'invalid JUMP',
  INSTRUCTION_NOT_SUPPORTED: 'instruction not supported',
  INVALID_OPCODE: 'invalid opcode',
  REVERT: 'revert',
  STATIC_STATE_CHANGE: 'static state change',
  INTERNAL_ERROR: 'internal error',
};

function VmError (error) {
  this.error = error;
  this.errorType = 'VmError';
};

const ERROR_KEYS = Object.keys(ERRNO_MAP);

const DEFAULT_CONTRACT_ADDRESS = Buffer.from('0f572e5295c57F15886F9b263E2f6d2d6c7b5ec6', 'hex');
const DEFAULT_CALLER = Buffer.from('cD1722f2947Def4CF144679da39c4C32bDc35681', 'hex');

const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

const OP_SWAP1 = parseInt(OP.SWAP1, 16);
const OP_SWAP16 = parseInt(OP.SWAP16, 16);
const OP_DUP1 = parseInt(OP.DUP1, 16);
const OP_DUP16 = parseInt(OP.DUP16, 16);

function NumToBuf32 (val) {
  val = val.toString(16);

  while (val.length !== 64) {
    val = '0' + val;
  }

  return Buffer.from(val, 'hex');
}

function NumToHex (val) {
  val = val.toString(16).replace('0x', '');

  if (val.length % 2 !== 0) {
    val = '0' + val;
  }

  return val;
}

module.exports = class OffchainStepper extends VM.MetaVM {
  async initAccounts (accounts) {
    const self = this;

    return new Promise((resolve, reject) => {
      let openCallbacks = 0;

      function resolveCallbacks () {
        if (--openCallbacks === 0) {
          resolve();
        }
      }

      let len = accounts.length;

      while (len--) {
        let obj = accounts[len];
        let addr = Buffer.from((obj.address || '').replace('0x', ''), 'hex');
        let account = new VM.deps.Account();

        account.balance = obj.balance | 0;

        // resolves immediately
        self.stateManager.putAccount(addr, account, () => {});

        if (obj.storage) {
          let storageLen = obj.storage.length;

          while (storageLen--) {
            let store = obj.storage[storageLen];

            openCallbacks++;
            self.stateManager.putContractStorage(
              addr,
              NumToBuf32(store.address | 0),
              NumToBuf32(store.value | 0),
              resolveCallbacks
            );
          }
        }
      }
      if (openCallbacks === 0) {
        resolve();
      }
    });
  }

  async dumpTouchedAccounts () {
    const self = this;

    return new Promise(
      (resolve, reject) => {
        let res = [];
        let openCallbacks = 0;

        function storageCallback (obj) {
          this.storage = obj;

          if (--openCallbacks === 0) {
            resolve(res);
          }
        }

        function callback (err, obj) {
          if (err) {
            throw err;
          }

          let account = {
            address: this,
            nonce: obj.nonce.toString('hex'),
            balance: obj.balance.toString('hex'),
            stateRoot: obj.stateRoot.toString('hex'),
            codeHash: obj.codeHash.toString('hex'),
          };
          res.push(account);

          self.stateManager.dumpStorage(this, storageCallback.bind(account));
        }

        self.stateManager._touched.forEach(
          (addr) => {
            openCallbacks++;
            self.stateManager.getAccount(addr, callback.bind(addr));
          }
        );

        if (!openCallbacks) {
          resolve(res);
        }
      }
    );
  }

  async runNextStep (runState) {
    if (runState.depth !== 0) {
      // throw is expected on errors. That's ok
      await super.runNextStep(runState);
      return;
    }

    runState.stateManager.checkpoint(() => {});

    let stack = toHex(runState.stack);
    let pc = runState.programCounter;
    let gasLeft = runState.gasLeft.addn(0);
    let exceptionError;

    try {
      await super.runNextStep(runState);
    } catch (e) {
      exceptionError = e;
    }

    let isCallDataRequired = false;
    let opcodeName = runState.opName;
    if (opcodeName === 'CALLDATASIZE' ||
      opcodeName === 'CALLDATACOPY' ||
      opcodeName === 'CALLDATALOAD') {
      isCallDataRequired = true;
    }

    let opcode = runState.opCode;
    let stackFixed;

    if (opcode >= OP_SWAP1 && opcode <= OP_SWAP16) {
      let x = 16 - (OP_SWAP16 - opcode);
      stackFixed = stack.slice(-(x * 2));
    }

    if (opcode >= OP_DUP1 && opcode <= OP_DUP16) {
      let x = 16 - (OP_DUP16 - opcode);
      stackFixed = stack.slice(-x);
    }

    let errno = 0;
    if (exceptionError) {
      // ethereumjs-vm is appending the location for jumps ;)
      const errorKeysLength = ERROR_KEYS.length;
      const errMsg = exceptionError.error
        ? exceptionError.error : exceptionError;

      for (let i = 0; i < errorKeysLength; i++) {
        const k = ERROR_KEYS[i];

        if (errMsg.startsWith(k)) {
          errno = ERRNO_MAP[k];
          break;
        }
      }
      runState.vmError = true;
    }

    if (errno === 0 && opcodeName !== 'RETURN') {
      pc = runState.programCounter;
    }

    // TODO: compact memory -& callData
    const isMemoryRequired = MEMORY_OPCODES.indexOf(opcodeName) !== -1;
    const compactStack = runState.stackIn ? stack.slice(-runState.stackIn) : (stackFixed || []);
    const returnData = runState.returnValue ? runState.returnValue.toString('hex') : '';
    const gasRemaining = runState.gasLeft.toNumber();
    const gasFee = gasLeft.sub(runState.gasLeft).toNumber();
    let mem = Buffer.from(runState.memory).toString('hex');
    while ((mem.length % 64) !== 0) {
      mem += '00';
    }

    stack = toHex(runState.stack);
    runState.context.steps.push({
      opcodeName: opcodeName,
      isCallDataRequired: isCallDataRequired,
      isMemoryRequired: isMemoryRequired,
      gasFee: gasFee,
      data: runState.context.data,
      stack: stack,
      compactStack: compactStack,
      mem: mem,
      returnData: returnData,
      pc: pc,
      errno: errno,
      gasRemaining: gasRemaining,
      logHash: runState.context.logHash,
    });
  }

  async run ({ code, data, stack, mem, accounts, logHash, gasLimit, blockGasLimit, gasRemaining, pc }) {
    data = data ? data.replace('0x', '') : '';
    blockGasLimit = Buffer.from(NumToHex(blockGasLimit || OP.BLOCK_GAS_LIMIT), 'hex');

    if (accounts) {
      await this.initAccounts(accounts);
      // commit to the tree, needs a checkpoint first 🤪
      await new Promise((resolve) => {
        this.stateManager.checkpoint(() => {
          this.stateManager.commit(() => {
            resolve();
          });
        });
      });
    }

    const context = {
      code: code,
      data: data,
      stack: stack,
      mem: mem,
      pc: pc | 0,
      gasRemaining: gasRemaining,
      steps: [],
      gasLeft: null,
      logHash: logHash || ZERO_HASH,
    };

    const defaultBlock = {
      header: {
        gasLimit: blockGasLimit,
        number: Buffer.from('00', 'hex'),
      },
    };

    const runState = await this.initRunState({
      code: Buffer.from(code.join(''), 'hex'),
      data: Buffer.from(data, 'hex'),
      gasLimit: Buffer.from(NumToHex(gasLimit || OP.BLOCK_GAS_LIMIT), 'hex'),
      gasPrice: 0,
      caller: DEFAULT_CALLER,
      origin: DEFAULT_CALLER,
      address: DEFAULT_CONTRACT_ADDRESS,
      block: defaultBlock,
      pc: context.pc,
    });
    runState.context = context;

    if (context.stack) {
      let len = context.stack.length;
      for (let i = 0; i < len; i++) {
        runState.stack.push(new BN(context.stack[i].replace('0x', ''), 'hex'));
      }
    }
    if (context.mem) {
      const tmp = context.mem.join ? context.mem.join('') : context.mem.replace('0x', '');
      const len = tmp.length;

      for (let i = 0; i < len;) {
        if (i % 64 === 0) {
          runState.memoryWordCount.iaddn(1);
        }
        let x = tmp.substring(i, i += 2);
        runState.memory.push(parseInt(x, 16));
      }

      const words = runState.memoryWordCount;
      // words * 3 + words ^2 / 512
      runState.highestMemCost = words.muln(3).add(words.mul(words).divn(512));
    }

    if (typeof context.gasRemaining !== 'undefined') {
      runState.gasLeft.isub(runState.gasLeft.sub(new BN(context.gasRemaining)));
    }

    await super.run(runState, 0);

    const self = this;
    let i = context.steps.length;
    while (i--) {
      context.steps[i].accounts = await this.dumpTouchedAccounts();

      await new Promise(
        (resolve, reject) => {
          self.stateManager.revert(
            () => {
              resolve(true);
            }
          );
        }
      );
    }

    return context.steps;
  }

  async handleCALL (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleDELEGATECALL (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSTATICCALL (runState) {
    let target = runState.stack[runState.stack.length - 2] || new BN(0xff);

    if (target.gten(0) && target.lten(8)) {
      await super.handleSTATICCALL(runState);
      return;
    }

    runState.lastReturned = Buffer.alloc(0);
    runState.stack = runState.stack.slice(0, runState.stack.length - 6);
    runState.stack.push(new BN(0));

    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCREATE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCREATE2 (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSELFDESTRUCT (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleLOG (runState) {
    await super.handleLOG(runState);

    let prevLogHash = runState.context.logHash.replace('0x', '');
    let log = runState.logs[runState.logs.length - 1];

    if (!log) {
      throw new Error('step with LOGx opcode but no log emitted');
    }

    let topics = log[1];
    while (topics.length !== 4) {
      topics.push(0);
    }
    runState.context.logHash = ethers.utils.solidityKeccak256(
      ['bytes32', 'address', 'uint[4]', 'bytes'],
      [
        '0x' + prevLogHash,
        '0x' + log[0].toString('hex'),
        topics,
        '0x' + log[2].toString('hex'),
      ]
    ).replace('0x', '');
  }
};
