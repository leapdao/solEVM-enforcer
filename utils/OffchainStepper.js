const VM = require('ethereumjs-vm');
const BN = VM.deps.ethUtil.BN;
const OP = require('./constants');

const toHex = arr => arr.map(e => '0x' + e.toString(16).padStart(64, '0'));

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

const OP_SWAP1 = parseInt(OP.SWAP1, 16);
const OP_SWAP16 = parseInt(OP.SWAP16, 16);
const OP_DUP1 = parseInt(OP.DUP1, 16);
const OP_DUP16 = parseInt(OP.DUP16, 16);

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

class RangeProofHelper {
  constructor (mem) {
    const self = this;

    const handler = {
      get: function (obj, prop) {
        if (prop === 'slice') {
          return this.slice;
        }

        const x = parseInt(prop);
        if (Number.isInteger(x)) {
          if (x < self.readLow || self.readLow === -1) {
            self.readLow = x;
          }
          if (x > self.readHigh || self.readHigh === -1) {
            self.readHigh = x;
          }
        }

        return obj[prop];
      },

      set: function (obj, prop, val) {
        obj[prop] = val;

        const x = parseInt(prop);
        if (Number.isInteger(x)) {
          if (x < self.writeLow || self.writeLow === -1) {
            self.writeLow = x;
          }
          if (x > self.writeHigh || self.writeHigh === -1) {
            self.writeHigh = x;
          }
        }

        return true;
      },

      slice: function (a, b) {
        if (a < self.readLow || self.readLow === -1) {
          self.readLow = a;
        }
        if (b > self.readHigh || self.readHigh === -1) {
          self.readHigh = b;
        }
        return mem.slice(a, b);
      },
    };

    this.data = mem;
    this.proxy = new Proxy(mem, handler);
  }

  reset () {
    this.readLow = -1;
    this.readHigh = -1;
    this.writeLow = -1;
    this.writeHigh = -1;
  }
}

module.exports = class OffchainStepper extends VM.MetaVM {
  constructor () {
    super({ hardfork: 'petersburg' });
  }

  static initialState (code, callData, customEnvironmentHash) {
    const DEFAULT_GAS = 0x0fffffffffffff;

    let codeBuffer = Buffer.from(code.join(''), 'hex');
    let rawCodes = OffchainStepper.getCodeInWord(codeBuffer, 0, 1);
    if (parseInt(code[0], 16) === parseInt(OP.PUSH32, 16)) {
      // second opcode
      rawCodes.push(OffchainStepper.getCodeInWord(codeBuffer, 32, 1));
    }

    return {
      executionState: {
        code: code,
        rawCodes,
        codeLength: codeBuffer.length,
        codeFragLength: rawCodes.length,
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
        customEnvironmentHash: customEnvironmentHash || OP.ZERO_HASH,
      },
    };
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

    let prevStep = runState.context.steps[runState.context.steps.length - 1] || {};
    // re-use if possible
    let stack = prevStep.stack || toHex(runState.stack);
    let pc = runState.programCounter;
    let gasLeft = runState.gasLeft.addn(0);
    let exceptionError;

    const memProof = runState.memProof;
    const callDataProof = runState.callDataProof;

    callDataProof.reset();
    memProof.reset();
    try {
      await super.runNextStep(runState);
    } catch (e) {
      exceptionError = e;
    }

    let opcode = runState.opCode;
    let nextOpcode = runState.code[pc];
    let stackFixed;

    if (nextOpcode >= OP_SWAP1 && nextOpcode <= OP_SWAP16) {
      let x = 16 - (OP_SWAP16 - nextOpcode);
      stackFixed = stack.slice(-(x * 2));
    }

    if (nextOpcode >= OP_DUP1 && nextOpcode <= OP_DUP16) {
      let x = 16 - (OP_DUP16 - nextOpcode);
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

    // if we have no errors and opcode is not RETURN or STOP, update pc
    if (errno === 0 && (opcode !== 0xf3 && opcode !== 0x00)) {
      pc = runState.programCounter;
    }

    if (runState.memoryWordCount.gt(MAX_MEM_WORD_COUNT)) {
      runState.vmError = true;
      errno = OP.ERROR_INTERNAL;
    }

    const compactStack = runState.stackIn ? stack.slice(-runState.stackIn) : (stackFixed || []);
    const returnData = '0x' + (runState.returnValue ? runState.returnValue.toString('hex') : '');
    const gasRemaining = runState.gasLeft.toNumber();
    const gasFee = gasLeft.sub(runState.gasLeft).toNumber();
    const memStore = runState.memProof.data;
    const mem = [];

    let i = 0;
    while (i < memStore.length) {
      let hexVal = Buffer.from(memStore.slice(i, i += 32)).toString('hex');
      while (hexVal.length !== 64) {
        hexVal += '00';
      }
      mem.push('0x' + hexVal);
    }
    // fill the remaing zero slots
    let memSize = runState.memoryWordCount.toNumber();
    while (mem.length < memSize) {
      mem.push(OP.ZERO_HASH);
    }

    stack = toHex(runState.stack);
    let isMemoryRequired = false;
    if (memProof.readHigh !== -1 || memProof.writeHigh !== -1) {
      isMemoryRequired = true;
    }

    let isCallDataRequired = false;
    if (callDataProof.readHigh !== -1 || callDataProof.writeHigh !== -1) {
      isCallDataRequired = true;
    }

    let rawCodes = [];
    if (parseInt(OP.PUSH1, 16) <= nextOpcode && nextOpcode <= parseInt(OP.PUSH32, 16)) {
      // PUSH opcode need some code data
      const len = nextOpcode - parseInt(OP.PUSH1, 16) + 1;
      rawCodes = OffchainStepper.getCodeInWord(runState.code, pc + 1, len);
    } else if (nextOpcode === parseInt(OP.JUMP, 16)) {
      // JUMP need the targeted pc is JUMPDEST
      rawCodes = OffchainStepper.getCodeInWord(runState.code, stack[stack.length - 1], 1);
      // TODO JUMPI
    } else if (nextOpcode === parseInt(OP.CODECOPY, 16)) {
      // CODECOPY need code of the required segment
      const offset = stack[stack.length - 2];
      const len = stack[stack.length - 3];
      rawCodes = OffchainStepper.getCodeInWord(runState.code, offset, len);
    }

    // get code contains current pc
    let pcCode = OffchainStepper.getCodeInWord(runState.code, pc, 1)[0];
    const found = rawCodes.find((el) => {
      return el.pos === pcCode.pos;
    });
    if (found === undefined) {
      rawCodes.push(pcCode);
    }

    rawCodes.sort((a, b) => {
      if (a.pos < b.pos) return -1;
      if (a.pos >= b.pos) return 1;
      return 0;
    });

    runState.context.steps.push({
      memReadLow: memProof.readLow,
      memReadHigh: memProof.readHigh,
      memWriteLow: memProof.writeLow,
      memWriteHigh: memProof.writeHigh,
      callDataReadLow: callDataProof.readLow,
      callDataReadHigh: callDataProof.readHigh,
      opcode: nextOpcode,
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
      rawCodes,
      codeLength: runState.code.length,
      codeFragLength: rawCodes.length,
    });
  }

  async run ({ code, data, stack, mem, gasLimit, blockGasLimit, gasRemaining, pc, stepCount }) {
    data = data || '0x';
    blockGasLimit = Buffer.from(NumToHex(blockGasLimit || OP.BLOCK_GAS_LIMIT), 'hex');

    // TODO: make it configurable by the user
    // init default account
    await this.initAccounts([{ code: code.join(''), address: DEFAULT_CONTRACT_ADDRESS }]);
    // commit to the tree, needs a checkpoint first 🤪
    await new Promise((resolve) => {
      this.stateManager.checkpoint(() => {
        this.stateManager.commit(() => {
          resolve();
        });
      });
    });

    const context = {
      code: code,
      data: data,
      stack: stack,
      mem: mem,
      pc: pc | 0,
      gasRemaining: gasRemaining,
      steps: [],
      gasLeft: gasRemaining,
    };

    const defaultBlock = {
      header: {
        gasLimit: blockGasLimit,
        number: Buffer.from('00', 'hex'),
      },
    };

    const runState = await this.initRunState({
      code: Buffer.from(code.join(''), 'hex'),
      data: Buffer.from(data.replace('0x', ''), 'hex'),
      gasLimit: Buffer.from(NumToHex(gasLimit || OP.BLOCK_GAS_LIMIT), 'hex'),
      gasPrice: 0,
      caller: DEFAULT_CALLER,
      origin: DEFAULT_CALLER,
      address: DEFAULT_CONTRACT_ADDRESS,
      block: defaultBlock,
      pc: context.pc,
    });
    runState.context = context;

    runState.memProof = new RangeProofHelper(runState.memory);
    runState.callDataProof = new RangeProofHelper(runState.callData);
    runState.callData = runState.callDataProof.proxy;
    runState.memory = runState.memProof.proxy;

    if (context.stack) {
      const len = context.stack.length;

      for (let i = 0; i < len; i++) {
        runState.stack.push(new BN(context.stack[i].replace('0x', ''), 'hex'));
      }
    }
    if (context.mem) {
      const len = context.mem.length;

      for (let i = 0; i < len; i++) {
        const memSlot = context.mem[i];

        runState.memoryWordCount.iaddn(1);

        for (let x = 2; x < 66;) {
          const hexVal = memSlot.substring(x, x += 2);

          runState.memProof.data.push(hexVal ? parseInt(hexVal, 16) : 0);
        }
      }

      const words = runState.memoryWordCount;
      // words * 3 + words ^2 / 512
      runState.highestMemCost = words.muln(3).add(words.mul(words).divn(512));
    }

    if (typeof context.gasRemaining !== 'undefined') {
      runState.gasLeft.isub(runState.gasLeft.sub(new BN(context.gasRemaining)));
    }

    await super.run(runState, stepCount | 0);

    return context.steps;
  }

  /**
   * @dev RawCode format:
   * [
   *   {
   *     pos: position (in word),
   *     value: uint256
   *   }
   * ]
   */
  static getCodeInWord (code, offset, len) {
    let wordPos = offset >> 5;
    let res = [];
    let val;

    while (len > 0) {
      // console.log('CODE', wordPos, code.slice(wordPos * 32, (wordPos + 1) * 32).toString('hex').padEnd(64, '0'));
      // val = new BN(code.slice(wordPos * 32, (wordPos + 1) * 32).toString('hex').padEnd(64, '0'), 'hex');
      val = '0x' + code.slice(wordPos * 32, (wordPos + 1) * 32).toString('hex').padEnd(64, '0');
      res.push({ pos: wordPos, value: val });
      wordPos++;
      len -= 32;
    }
    return res;
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

  async handleEXTCODEHASH (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleLOG (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }
};
