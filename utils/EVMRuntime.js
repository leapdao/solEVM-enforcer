'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

const OP = require('./constants');
const OPCODES = require('./Opcodes');

const { emptyTokenBag } = require('../test/helpers/tokenBag.js');

const PRECOMPILED = {
  '1': require('./precompiled/01-ecrecover.js'),
  '2': require('./precompiled/02-sha256.js'),
  '3': require('./precompiled/03-ripemd160.js'),
  '4': require('./precompiled/04-identity.js'),
  '5': require('./precompiled/05-modexp.js'),
  '6': require('./precompiled/06-ecadd.js'),
  '7': require('./precompiled/07-ecmul.js'),
  '8': require('./precompiled/08-ecpairing.js'),
};

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

// Find Ceil(`this` / `num`)
function divCeil (a, b) {
  const div = a.div(b);
  const mod = a.mod(b);

  // Fast case - exact division
  if (mod.isZero()) {
    return div;
  }

  // Round up
  return div.isNeg() ? div.isubn(1) : div.iaddn(1);
}

module.exports = class EVMRuntime {
  constructor () {
  }

  async runNextStep (runState) {
    let exceptionError;
    try {
      const opCode = runState.code[runState.programCounter];
      const opInfo = OPCODES[opCode] || ['INVALID', 0, 0, 0];
      const opName = opInfo[0];

      runState.opName = opName;
      runState.opCode = opCode;
      runState.stackIn = opInfo[2];
      runState.stackOut = opInfo[3];

      if (runState.stack.length < runState.stackIn) {
        throw new VmError(ERROR.STACK_UNDERFLOW);
      }

      if ((runState.stack.length - runState.stackIn + runState.stackOut) > 1024) {
        throw new VmError(ERROR.STACK_OVERFLOW);
      }

      runState.gasLeft = runState.gasLeft.subn(opInfo[1]);
      if (runState.gasLeft.ltn(0)) {
        runState.gasLeft = new BN(0);
        throw new VmError(ERROR.OUT_OF_GAS);
      }

      runState.programCounter++;

      await this['handle' + opName](runState);
    } catch (e) {
      exceptionError = e;
    }

    let errno = 0;
    if (exceptionError) {
      errno = ERRNO_MAP[exceptionError.error] || 0xff;
      runState.vmError = true;
    }

    if (runState.memoryWordCount.gt(MAX_MEM_WORD_COUNT)) {
      runState.vmError = true;
      errno = OP.ERROR_INTERNAL;
    }

    runState.errno = errno;
  }

  async initRunState (obj) {
    const runState = {
      code: obj.code,
      callData: obj.data,
      gasLimit: new BN(obj.gasLimit),
      caller: obj.caller,
      origin: obj.origin,
      address: obj.address,
      blockHash: obj.blockHash || Buffer.alloc(0),
      blockTime: obj.blockTime || Buffer.alloc(0),
      blockNumber: obj.blockNumber || Buffer.alloc(0),
      memory: [],
      stack: [],
      gasLeft: new BN(obj.gasLimit),
      memoryWordCount: new BN(0),
      highestMemCost: new BN(0),
      stackIn: 0,
      stackOut: 0,
      programCounter: obj.pc | 0,
      errno: 0,
      vmError: false,
      stopped: false,
      returnValue: Buffer.alloc(0),
      validJumps: {},
      tokenBag: obj.tokenBag || emptyTokenBag(),
    };

    const len = runState.code.length;

    for (let i = 0; i < len; i++) {
      const op = OPCODES[runState.code[i]] || ['INVALID'];

      if (op[0] === 'PUSH') {
        i += runState.code[i] - 0x5f;
      }

      if (op[0] === 'JUMPDEST') {
        runState.validJumps[i] = true;
      }
    }

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

  async run ({ code, data, stack, mem, gasLimit, gasRemaining, pc, stepCount, tokenBag }) {
    data = data || '0x';

    if (Array.isArray(code)) {
      code = code.join('');
    } else {
      // should be a (hex) string
      code = code.replace('0x', '');
    }

    // TODO: Support EVMParameters
    const runState = await this.initRunState({
      code: Buffer.from(code, 'hex'),
      data: Buffer.from(data.replace('0x', ''), 'hex'),
      gasLimit: Buffer.from(NumToHex(gasLimit || OP.BLOCK_GAS_LIMIT), 'hex'),
      caller: DEFAULT_CALLER,
      origin: DEFAULT_CALLER,
      address: DEFAULT_CONTRACT_ADDRESS,
      pc: pc | 0,
      mem,
      stack,
      gasRemaining,
      tokenBag,
    });

    stepCount = stepCount | 0;

    while (!runState.stopped && !runState.vmError && runState.programCounter < runState.code.length) {
      await this.runNextStep(runState);

      if (stepCount !== 0) {
        if (--stepCount === 0) {
          break;
        }
      }
    }

    return runState;
  }

  async handleSTOP (runState) {
    runState.stopped = true;
  }

  async handleADD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.add(b).mod(utils.TWO_POW256));
  }

  async handleMUL (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.mul(b).mod(utils.TWO_POW256));
  }

  async handleSUB (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.sub(b).toTwos(256));
  }

  async handleDIV (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      r = a.div(b);
    }
    runState.stack.push(r);
  }

  async handleSDIV (runState) {
    let a = runState.stack.pop();
    let b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      a = a.fromTwos(256);
      b = b.fromTwos(256);
      r = a.div(b).toTwos(256);
    }
    runState.stack.push(r);
  }

  async handleMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      r = a.mod(b);
    }
    runState.stack.push(r);
  }

  async handleSMOD (runState) {
    let a = runState.stack.pop();
    let b = runState.stack.pop();
    let r;

    if (b.isZero()) {
      r = new BN(b);
    } else {
      a = a.fromTwos(256);
      b = b.fromTwos(256);
      r = a.abs().mod(b.abs());
      if (a.isNeg()) {
        r = r.ineg();
      }
      r = r.toTwos(256);
    }
    runState.stack.push(r);
  }

  async handleADDMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const c = runState.stack.pop();
    let r;

    if (c.isZero()) {
      r = new BN(c);
    } else {
      r = a.add(b).mod(c);
    }
    runState.stack.push(r);
  }

  async handleMULMOD (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const c = runState.stack.pop();
    let r;

    if (c.isZero()) {
      r = new BN(c);
    } else {
      r = a.mul(b).mod(c);
    }
    runState.stack.push(r);
  }

  async handleEXP (runState) {
    const base = runState.stack.pop();
    const exponent = runState.stack.pop();

    if (exponent.isZero()) {
      runState.stack.push(new BN(1));
      return;
    }

    const byteLength = exponent.byteLength();

    if (byteLength < 1 || byteLength > 32) {
      throw new VmError(ERROR.OUT_OF_RANGE);
    }

    const gasFee = new BN(byteLength).muln(50);

    this.subGas(runState, gasFee);

    if (base.isZero()) {
      runState.stack.push(new BN(0));
      return;
    }

    const m = BN.red(utils.TWO_POW256);
    const redBase = base.toRed(m);
    const r = redBase.redPow(exponent);

    runState.stack.push(r.fromRed());
  }

  async handleSIGNEXTEND (runState) {
    const k = runState.stack.pop();
    let val = runState.stack.pop();

    if (k.ltn(31)) {
      const signBit = k
        .muln(8)
        .iaddn(7)
        .toNumber();
      const mask = new BN(1).ishln(signBit).isubn(1);
      if (val.testn(signBit)) {
        val = val.or(mask.notn(256));
      } else {
        val = val.and(mask);
      }
    } else {
      val = new BN(val);
    }
    runState.stack.push(val);
  }

  async handleLT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.lt(b) ? 1 : 0));
  }

  async handleGT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.gt(b) ? 1 : 0));
  }

  async handleSLT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.fromTwos(256).lt(b.fromTwos(256)) ? 1 : 0));
  }

  async handleSGT (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.fromTwos(256).gt(b.fromTwos(256)) ? 1 : 0));
  }

  async handleEQ (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(new BN(a.eq(b) ? 1 : 0));
  }

  async handleISZERO (runState) {
    const a = runState.stack.pop();

    runState.stack.push(new BN(a.isZero() ? 1 : 0));
  }

  async handleAND (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.and(b));
  }

  async handleOR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.or(b));
  }

  async handleXOR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    runState.stack.push(a.xor(b));
  }

  async handleNOT (runState) {
    const a = runState.stack.pop();

    runState.stack.push(a.notn(256));
  }

  async handleBYTE (runState) {
    const pos = runState.stack.pop();
    const word = runState.stack.pop();

    if (pos.gten(32)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(new BN(word.shrn((31 - pos.toNumber()) * 8).andln(0xff)));
  }

  async handleSHL (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    if (a.gten(256)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(b.shln(a.toNumber()).iand(utils.MAX_INTEGER));
  }

  async handleSHR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();

    if (a.gten(256)) {
      runState.stack.push(new BN(0));
      return;
    }

    runState.stack.push(b.shrn(a.toNumber()));
  }

  async handleSAR (runState) {
    const a = runState.stack.pop();
    const b = runState.stack.pop();
    const isSigned = b.testn(255);
    let r;

    if (a.gten(256)) {
      if (isSigned) {
        r = new BN(utils.MAX_INTEGER);
      } else {
        r = new BN(0);
      }
      runState.stack.push(r);
      return;
    }

    const c = b.shrn(a.toNumber());
    if (isSigned) {
      const shiftedOutWidth = 255 - a.toNumber();
      const mask = utils.MAX_INTEGER.shrn(shiftedOutWidth).shln(shiftedOutWidth);

      r = c.ior(mask);
    } else {
      r = c;
    }
    runState.stack.push(r);
  }

  async handleSHA3 (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();
    let data = Buffer.alloc(0);

    if (!length.isZero()) {
      data = this.memLoad(runState, offset, length);
    }

    this.subGas(
      runState,
      new BN(6).imul(divCeil(length, new BN(32))),
    );
    runState.stack.push(new BN(utils.keccak256(data)));
  }

  async handleADDRESS (runState) {
    runState.stack.push(new BN(runState.address));
  }

  async handleBALANCE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleORIGIN (runState) {
    runState.stack.push(new BN(runState.origin));
  }

  async handleCALLER (runState) {
    runState.stack.push(new BN(runState.caller));
  }

  async handleCALLVALUE (runState) {
    runState.stack.push(new BN(0));
  }

  async handleCALLDATALOAD (runState) {
    const pos = runState.stack.pop();

    if (pos.gtn(runState.callData.length)) {
      runState.stack.push(new BN(0));
      return;
    }

    const i = pos.toNumber();
    let loaded = runState.callData.slice(i, i + 32);
    loaded = loaded.length ? loaded : Buffer.from([0]);

    runState.stack.push(new BN(utils.setLengthRight(loaded, 32)));
  }

  async handleCALLDATASIZE (runState) {
    runState.stack.push(new BN(runState.callData.length));
  }

  async handleCALLDATACOPY (runState) {
    const memOffset = runState.stack.pop();
    const dataOffset = runState.stack.pop();
    const dataLength = runState.stack.pop();

    this.subGas(runState, new BN(3).imul(divCeil(dataLength, new BN(32))));
    this.memStore(runState, memOffset, runState.callData, dataOffset, dataLength);
  }

  async handleCODESIZE (runState) {
    runState.stack.push(new BN(runState.code.length));
  }

  async handleCODECOPY (runState) {
    const memOffset = runState.stack.pop();
    const codeOffset= runState.stack.pop();
    const length = runState.stack.pop();

    this.subGas(runState, new BN(3).imul(divCeil(length, new BN(32))));
    this.memStore(runState, memOffset, runState.code, codeOffset, length);
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

  async handleRETURNDATASIZE (runState) {
    runState.stack.push(new BN(runState.returnValue.length));
  }

  async handleRETURNDATACOPY (runState) {
    const memOffset = runState.stack.pop();
    const returnDataOffset = runState.stack.pop();
    const length = runState.stack.pop();

    // TODO: check if this the desired behaviour
    if ((returnDataOffset.add(length)).gtn(runState.returnValue.length)) {
      throw new VmError(ERROR.OUT_OF_GAS);
    }

    this.subGas(runState, new BN(3).mul(divCeil(length, new BN(32))));
    this.memStore(runState, memOffset, utils.toBuffer(runState.returnValue), returnDataOffset, length, false);
  }

  async handleGASPRICE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleBLOCKHASH (runState) {
    // TODO/Question: Do we care about `blockNum`?
    const blockNum = runState.stack.pop();

    runState.stack.push(new BN(runState.blockHash));
  }

  async handleCOINBASE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleTIMESTAMP (runState) {
    runState.stack.push(new BN(runState.blockTime));
  }

  async handleNUMBER (runState) {
    runState.stack.push(new BN(runState.blockNumber));
  }

  async handleDIFFICULTY (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleGASLIMIT (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handlePOP (runState) {
    runState.stack.pop();
  }

  async handleMLOAD (runState) {
    const pos = runState.stack.pop();

    runState.stack.push(new BN(this.memLoad(runState, pos, new BN(32))));
  }

  async handleMSTORE (runState) {
    const offset = runState.stack.pop();
    let word = runState.stack.pop();

    word = word.toArrayLike(Buffer, 'be', 32);
    this.memStore(runState, offset, word, new BN(0), new BN(32));
  }

  async handleMSTORE8 (runState) {
    const offset = runState.stack.pop();
    let byte = runState.stack.pop();

    // NOTE: we're using a 'trick' here to get the least significant byte
    byte = Buffer.from([ byte.andln(0xff) ]);
    this.memStore(runState, offset, byte, new BN(0), new BN(1));
  }

  async handleSLOAD (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSSTORE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleJUMP (runState) {
    const dest = runState.stack.pop();

    if (dest.gtn(runState.code.length)) {
      throw new VmError(ERROR.INVALID_JUMP);
    }

    const destNum = dest.toNumber();

    if (!runState.validJumps[destNum]) {
      throw new VmError(ERROR.INVALID_JUMP);
    }

    runState.programCounter = destNum;
  }

  async handleJUMPI (runState) {
    const dest = runState.stack.pop();
    const cond = runState.stack.pop();

    if (!cond.isZero()) {
      if (dest.gtn(runState.code.length)) {
        throw new VmError(ERROR.INVALID_JUMP);
      }

      const destNum = dest.toNumber();

      if (!runState.validJumps[destNum]) {
        throw new VmError(ERROR.INVALID_JUMP);
      }

      runState.programCounter = destNum;
    }
  }

  async handlePC (runState) {
    runState.stack.push(new BN(runState.programCounter - 1));
  }

  async handleMSIZE (runState) {
    runState.stack.push(runState.memoryWordCount.muln(32));
  }

  async handleGAS (runState) {
    runState.stack.push(new BN(runState.gasLeft));
  }

  async handleJUMPDEST (runState) {
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

  async handleDUP (runState) {
    const stackPos = runState.opCode - 0x7f;

    if (stackPos > runState.stack.length) {
      throw new VmError(ERROR.STACK_UNDERFLOW);
    }

    runState.stack.push(new BN(runState.stack[runState.stack.length - stackPos]));
  }

  async handleSWAP (runState) {
    const stackPos = runState.opCode - 0x8f;
    const swapIndex = runState.stack.length - stackPos - 1;

    if (swapIndex < 0) {
      throw new VmError(ERROR.STACK_UNDERFLOW);
    }

    const topIndex = runState.stack.length - 1;
    const tmp = runState.stack[topIndex];

    runState.stack[topIndex] = runState.stack[swapIndex];
    runState.stack[swapIndex] = tmp;
  }

  async handleLOG (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCREATE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCREATE2 (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCALL (runState) {

    const gasLimit = runState.stack.pop();
    const toAddress = runState.stack.pop();
    const value = runState.stack.pop();
    const inOffset = runState.stack.pop();
    const inLength = runState.stack.pop();
    const outOffset = runState.stack.pop();
    const outLength = runState.stack.pop();

    const data = this.memLoad(runState, inOffset, inLength);
    const funcSig = this.getFuncSig(data);

    if (funcSig === OP.FUNCSIG_TRANSFER) {
      this.subMemUsage(runState, outOffset, outLength);

      if (gasLimit.gt(runState.gasLeft)) {
        gasLimit = new BN(runState.gasLeft);
      }

      const color = '0x' + toAddress.toString(16, 40);
      const to = utils.bufferToHex(data.slice(4, 24));
      const from = utils.bufferToHex(runState.caller);
      const amount = utils.bufferToHex(data.slice(36, 68));

      const success = runState.tokenBag.transfer(color, from, to, amount);

      if (success) {
        runState.stack.push(new BN(OP.CALLISH_SUCCESS));
        const returnValue =  utils.setLengthRight(utils.toBuffer('0x01'), 32);
        this.memStore(runState, outOffset, returnValue, new BN(0), outLength, 32);
        runState.returnValue = returnValue;
      } else {
        runState.returnValue = Buffer.alloc(0);
        runState.stack.push(new BN(OP.CALLISH_FAIL));
        return;
      }
    }
    
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleCALLCODE (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleDELEGATECALL (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleSTATICCALL (runState) {
    let gasLimit = runState.stack.pop();
    const toAddress = runState.stack.pop() || new BN(0xff);
    const inOffset = runState.stack.pop();
    const inLength = runState.stack.pop();
    const outOffset = runState.stack.pop();
    const outLength = runState.stack.pop();

    const data = this.memLoad(runState, inOffset, inLength);
    const funcSig = this.getFuncSig(data);
    
    if (toAddress.gten(0) && toAddress.lten(8)) {
      this.subMemUsage(runState, outOffset, outLength);

      if (gasLimit.gt(runState.gasLeft)) {
        gasLimit = new BN(runState.gasLeft);
      }

      const precompile = PRECOMPILED[toAddress.toString()];
      const r = await precompile(gasLimit, data);

      runState.returnValue = r.returnValue;
      runState.stack.push(new BN(r.exception));

      this.subGas(runState, r.gasUsed);
      this.memStore(runState, outOffset, r.returnValue, new BN(0), outLength, true);
      return;
    } else if (funcSig === OP.FUNCSIG_BALANCEOF) {
      const color = '0x' + toAddress.toString(16, 40);
      const addr = utils.bufferToHex(data.slice(4, 24));
      const balance = runState.tokenBag.balanceOf(color, addr);
      const returnValue =  utils.setLengthLeft(utils.toBuffer(balance), 32);
      
      this.memStore(runState, outOffset, returnValue, new BN(0), outLength, 32);
      runState.stack.push(new BN(OP.CALLISH_SUCCESS));
      runState.returnValue = returnValue;
      return;
    } else if (funcSig === OP.FUNCSIG_READATA) {
      const color = '0x' + toAddress.toString(16, 40);
      const tokenId = utils.bufferToHex(data.slice(4, 36));
      const returnValue = utils.toBuffer(runState.tokenBag.readData(color, tokenId));

      this.memStore(runState, outOffset, returnValue, new BN(0), outLength, 32);
      runState.stack.push(new BN(OP.CALLISH_SUCCESS));
      runState.returnValue = returnValue;
      return;
    }

    // TODO: remove this and throw first, sync behaviour with contracts
    runState.returnValue = Buffer.alloc(0);
    runState.stack = runState.stack.slice(0, runState.stack.length - 6);
    runState.stack.push(new BN(OP.CALLISH_FAIL));

    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleRETURN (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();

    runState.stopped = true;
    runState.returnValue = this.memLoad(runState, offset, length);
  }

  async handleREVERT (runState) {
    const offset = runState.stack.pop();
    const length = runState.stack.pop();

    runState.returnValue = this.memLoad(runState, offset, length);
    throw new VmError(ERROR.REVERT);
  }

  async handleSELFDESTRUCT (runState) {
    throw new VmError(ERROR.INSTRUCTION_NOT_SUPPORTED);
  }

  async handleINVALID (runState) {
    throw new VmError(ERROR.INVALID_OPCODE);
  }

  subMemUsage (runState, offset, length) {
    if (length.isZero()) {
      return;
    }

    const words = divCeil(offset.add(length), new BN(32));

    if (words.lte(runState.memoryWordCount)) {
      return;
    }

    // words * 3 + words ^2 / 512
    const cost = words.muln(3).add(words.mul(words).divn(512));

    if (cost.gt(runState.highestMemCost)) {
      this.subGas(runState, cost.sub(runState.highestMemCost));
      runState.highestMemCost = cost;
    }

    runState.memoryWordCount = words;
  }

  subGas (runState, amount) {
    runState.gasLeft.isub(amount);

    if (runState.gasLeft.ltn(0)) {
      runState.gasLeft = new BN(0);
      throw new VmError(ERROR.OUT_OF_GAS);
    }
  }

  memStore (runState, offset, val, valOffset, length, skipSubMem) {
    if (skipSubMem !== false) {
      this.subMemUsage(runState, offset, length);
    }

    if (length.isZero()) {
      return;
    }

    let safeLen = 0;
    if (valOffset.add(length).gtn(val.length)) {
      if (valOffset.gten(val.length)) {
        safeLen = 0;
      } else {
        valOffset = valOffset.toNumber();
        safeLen = val.length - valOffset;
      }
    } else {
      valOffset = valOffset.toNumber();
      safeLen = val.length;
    }

    let i = 0;

    offset = offset.toNumber();
    length = length.toNumber();
    if (safeLen > 0) {
      safeLen = safeLen > length ? length : safeLen;
      for (; i < safeLen; i++) {
        runState.memory[offset + i] = val[valOffset + i];
      }
    }

    if (val.length > 0 && i < length) {
      for (; i < length; i++) {
        runState.memory[offset + i] = 0;
      }
    }
  }

  memLoad (runState, offset, length) {
    this.subMemUsage(runState, offset, length);

    if (length.isZero()) {
      return Buffer.alloc(0);
    }

    offset = offset.toNumber();
    length = length.toNumber();

    const loaded = runState.memory.slice(offset, offset + length);

    for (let i = loaded.length; i < length; i++) {
      loaded[i] = 0;
    }

    return Buffer.from(loaded);
  }

  getFuncSig (data) {
    if (data.length < 3) {
      return 0x00000000;
    }
    return utils.bufferToHex(data.slice(0, 4));
  }
};
