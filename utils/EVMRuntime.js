'use strict';

const VM = require('ethereumjs-vm');
const BN = VM.deps.ethUtil.BN;
const OP = require('./constants');

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

// 256x32 bytes
const MAX_MEM_WORD_COUNT = new BN(256);

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

module.exports = class EVMRuntime extends VM.MetaVM {
  constructor () {
    super({ hardfork: 'petersburg' });
  }

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
        let addr = Buffer.isBuffer(obj.address)
          ? obj.address : Buffer.from((obj.address || '').replace('0x', ''), 'hex');
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

        if (obj.code) {
          openCallbacks++;
          self.stateManager.putContractCode(addr, Buffer.from(obj.code, 'hex'), resolveCallbacks);
        }
      }
      if (openCallbacks === 0) {
        resolve();
      }
    });
  }

  async runNextStep (runState) {
    if (runState.depth !== 0) {
      // throw is expected on errors. That's ok
      await super.runNextStep(runState);
      return;
    }

    let exceptionError;
    try {
      await super.runNextStep(runState);
    } catch (e) {
      exceptionError = e;
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

    if (runState.memoryWordCount.gt(MAX_MEM_WORD_COUNT)) {
      runState.vmError = true;
      errno = OP.ERROR_INTERNAL;
    }

    runState.errno = errno;
  }

  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.errno = 0;

    if (obj.stack) {
      const len = obj.stack.length;

      for (let i = 0; i < len; i++) {
        runState.stack.push(new BN(obj.stack[i].replace('0x', ''), 'hex'));
      }
    }
    if (obj.mem) {
      const len = obj.mem.length;

      for (let i = 0; i < len; i++) {
        const memSlot = obj.mem[i];

        runState.memoryWordCount.iaddn(1);

        for (let x = 2; x < 66;) {
          const hexVal = memSlot.substring(x, x += 2);

          runState.memory.push(hexVal ? parseInt(hexVal, 16) : 0);
        }
      }

      const words = runState.memoryWordCount;
      // words * 3 + words ^2 / 512
      runState.highestMemCost = words.muln(3).add(words.mul(words).divn(512));
    }

    if (typeof obj.gasRemaining !== 'undefined') {
      runState.gasLeft = new BN(Buffer.from(NumToHex(obj.gasRemaining), 'hex'));
    }

    return runState;
  }

  async run ({ code, data, stack, mem, gasLimit, blockGasLimit, gasRemaining, pc, stepCount }) {
    data = data || '0x';
    blockGasLimit = Buffer.from(NumToHex(blockGasLimit || OP.BLOCK_GAS_LIMIT), 'hex');

    if (Array.isArray(code)) {
      code = code.join('');
    } else {
      // should be a (hex) string
      code = code.replace('0x', '');
    }

    // TODO: make it configurable by the user
    // init default account
    await this.initAccounts([{ code: code, address: DEFAULT_CONTRACT_ADDRESS }]);
    // commit to the tree, needs a checkpoint first 🤪
    await new Promise((resolve) => {
      this.stateManager.checkpoint(() => {
        this.stateManager.commit(() => {
          resolve();
        });
      });
    });

    const defaultBlock = {
      header: {
        gasLimit: blockGasLimit,
        number: Buffer.from('00', 'hex'),
      },
    };

    const runState = await this.initRunState({
      code: Buffer.from(code, 'hex'),
      data: Buffer.from(data.replace('0x', ''), 'hex'),
      gasLimit: Buffer.from(NumToHex(gasLimit || OP.BLOCK_GAS_LIMIT), 'hex'),
      gasPrice: 0,
      caller: DEFAULT_CALLER,
      origin: DEFAULT_CALLER,
      address: DEFAULT_CONTRACT_ADDRESS,
      block: defaultBlock,
      pc: pc | 0,
      mem,
      stack,
      gasRemaining,
    });

    await super.run(runState, stepCount | 0);

    return runState;
  }

  async handlePUSH (runState) {
    // needs to be right-padded with zero
    const numToPush = runState.opCode - 0x5f;
    const result = new BN(
      runState.code.slice(
        runState.programCounter, runState.programCounter + numToPush
      ).toString('hex').padEnd(numToPush * 2, '0')
      ,
      16
    );

    runState.programCounter += numToPush;
    runState.stack.push(result);
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

  async handleCALLCODE (runState) {
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

  async handleSLOAD (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSSTORE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleBALANCE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleEXTCODESIZE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleEXTCODECOPY (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleEXTCODEHASH (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleLOG (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }
};
