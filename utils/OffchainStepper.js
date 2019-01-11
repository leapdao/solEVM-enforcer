
const VM = require('ethereumjs-vm');
const BN = VM.deps.ethUtil.BN;
const ethers = require('ethers');
const OP = require('../test/helpers/constants');

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
    'CALL',
    'RETURN',
    'DELEGATECALL',
    'STATICCALL',
    'REVERT',
    'CALLDATACOPY',
    'CODECOPY',
    'EXTCODECOPY',
    'RETURNDATACOPY',
    'MSTORE',
    'MSTORE8',
  ];

const CODE_OPCODES =
  [
    'CODECOPY',
    'CODESIZE',
    'JUMP',
    'JUMPI',
    // PUSH has boundary checks
    'PUSH1',
    'PUSH2',
    'PUSH3',
    'PUSH4',
    'PUSH5',
    'PUSH6',
    'PUSH7',
    'PUSH8',
    'PUSH9',
    'PUSH10',
    'PUSH11',
    'PUSH12',
    'PUSH13',
    'PUSH14',
    'PUSH15',
    'PUSH16',
    'PUSH17',
    'PUSH18',
    'PUSH19',
    'PUSH20',
    'PUSH21',
    'PUSH22',
    'PUSH23',
    'PUSH24',
    'PUSH25',
    'PUSH26',
    'PUSH27',
    'PUSH28',
    'PUSH29',
    'PUSH30',
    'PUSH31',
    'PUSH32',
  ];

// Supported by ethereumjs-vm
const ERRNO_MAP =
  {

    'stack overflow': 0x01,
    'stack underflow': 0x02,
    'invalid opcode': 0x04,
    'invalid JUMP': 0x05,
    'revert': 0x07,
    'static state change': 0x0b,
    'out of gas': 0x0d,
    'internal error': 0xff,
  };

const ERROR_KEYS = Object.keys(ERRNO_MAP);

const DEFAULT_CONTRACT_ADDRESS = Buffer.from('0f572e5295c57F15886F9b263E2f6d2d6c7b5ec6', 'hex');
const DEFAULT_CALLER = Buffer.from('cD1722f2947Def4CF144679da39c4C32bDc35681', 'hex');

const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function NumToBuf32 (val) {
  val = val.toString(16);

  while (val.length !== 64) {
    val = '0' + val;
  }

  return Buffer.from(val, 'hex');
}

export default class OffchainStepper {
  static async initAccounts (evm, accounts) {
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
        evm.stateManager.putAccount(addr, account, () => {});

        if (obj.storage) {
          let storageLen = obj.storage.length;

          while (storageLen--) {
            let store = obj.storage[storageLen];

            openCallbacks++;
            evm.stateManager.putContractStorage(
              addr,
              NumToBuf32(store.address | 0),
              NumToBuf32(store.value | 0),
              resolveCallbacks
            );
          }
        }
      }
    });
  }

  static async dumpTouchedAccounts (evm) {
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

          evm.stateManager.dumpStorage(this, storageCallback.bind(account));
        }

        evm.stateManager._touched.forEach(
          (addr) => {
            openCallbacks++;
            evm.stateManager.getAccount(addr, callback.bind(addr));
          }
        );

        if (!openCallbacks) {
          resolve(res);
        }
      }
    );
  }

  static _finishPrevStep (context, _stack, _mem, pc, gasLeft, returnData, exceptionError) {
    if (!context.steps.length) {
      return;
    }

    let prevStep = context.steps[context.steps.length - 1];
    let isFullCodeNeeded = CODE_OPCODES.indexOf(prevStep.opcodeName) !== -1;

    if (isFullCodeNeeded) {
      prevStep.input.code = context.code;
      prevStep.input.isCodeCompacted = false;
    } else {
      prevStep.input.code = context.code.slice(context.pc, pc);
      prevStep.input.isCodeCompacted = true;
    }

    if (prevStep.output.compactStack.length) {
      prevStep.output.compactStack = _stack.slice(-prevStep.output.compactStack.length);
    }

    prevStep.output.stack = _stack;
    prevStep.output.mem = _mem;
    prevStep.output.gasRemaining = gasLeft.toNumber();
    prevStep.gasFee = context.gasLeft.sub(gasLeft).toNumber();

    if (returnData) {
      prevStep.output.returnData = returnData.toString('hex');
    }

    let errno = 0;
    if (exceptionError) {
      // ethereumvm-js is appending the location for jumps ;)
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
    }
    prevStep.output.errno = errno;

    if (prevStep.output.errno === 0 && prevStep.opcodeName !== 'RETURN') {
      prevStep.output.pc = pc;
    }
  }

  static _onStep (evt, context) {
    if (context.inject) {
      context.inject = false;

      if (context.stack) {
        let len = context.stack.length;
        for (let i = 0; i < len; i++) {
          evt.stack.push(new BN(context.stack[i].replace('0x', ''), 'hex'));
        }
        // For fixing the logic below
        evt.opcode.out += len;
      }
      if (context.mem) {
        const tmp = Buffer.from(context.mem.replace('0x', ''), 'hex');
        const len = tmp.length;

        for (let i = 0; i < len; i++) {
          evt.memory.push(tmp[i]);
          if (i % 32 === 0) {
            evt.memoryWordCount.iaddn(1);
          }
        }
      }

      if (typeof context.gasRemaining !== 'undefined') {
        evt.gasLeft.isub(evt.gasLeft.sub(new BN(context.gasRemaining)));
      }
    }

    evt.stateManager.checkpoint(() => {});

    let isCallDataRequired = false;
    let opcodeName = evt.opcode.name;
    if (opcodeName === 'CALLDATASIZE' ||
      opcodeName === 'CALLDATACOPY' ||
      opcodeName === 'CALLDATALOAD') {
      isCallDataRequired = true;
    }

    let swap1 = parseInt(OP.SWAP1, 16);
    let swap16 = parseInt(OP.SWAP16, 16);
    let dup1 = parseInt(OP.DUP1, 16);
    let dup16 = parseInt(OP.DUP16, 16);

    let opcode = evt.opcode.opcode;

    let stackFixed;
    if (opcode >= swap1 && opcode <= swap16) {
      let x = 16 - (swap16 - opcode);
      stackFixed = toHex(evt.stack.slice(-(x * 2)));
    }

    if (opcode >= dup1 && opcode <= dup16) {
      let x = 16 - (dup16 - opcode);
      stackFixed = toHex(evt.stack.slice(-x));
    }

    let isMemoryRequired = MEMORY_OPCODES.indexOf(opcodeName) !== -1;
    let _stack = toHex(evt.stack);
    let _mem = Buffer.from(evt.memory).toString('hex');

    while ((_mem.length % 64) !== 0) {
      _mem += '00';
    }

    let pc = evt.pc;
    let step = {
      opcodeName: evt.opcode.name,
      input: {
        data: context.data,
        stack: _stack,
        compactStack: evt.opcode.in ? _stack.slice(-evt.opcode.in) : (stackFixed || []),
        mem: _mem,
        returnData: '',
        pc: pc,
        gasRemaining: evt.gasLeft.toNumber(),
      },
      output: {
        data: context.data,
        compactStack: new Array(evt.opcode.out),
        mem: '',
        returnData: '',
        pc: pc,
        errno: 0,
        gasRemaining: 0,
      },
      isCallDataRequired: isCallDataRequired,
      isMemoryRequired: isMemoryRequired,
    };

    this._finishPrevStep(context, _stack, _mem, pc, evt.gasLeft);

    context.steps.push(step);

    context.pc = pc;
    context.gasLeft = evt.gasLeft;
  }

  static async run ({ code, data, stack, mem, accounts, logHash, gasLimit, blockGasLimit, gasRemaining, pc }) {
    data = data ? data.replace('0x', '') : '';
    blockGasLimit = Buffer.from(
      (blockGasLimit || OP.BLOCK_GAS_LIMIT).toString(16).replace('0x', ''),
      'hex'
    );

    const evm = new VM();

    if (accounts) {
      await this.initAccounts(evm, accounts);
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
      inject: true,
    };

    evm.on('step', (evt) => this._onStep(evt, context));

    const defaultBlock = {
      header: {
        gasLimit: blockGasLimit,
        number: Buffer.from('00', 'hex'),
      },
    };

    const steps = await new Promise((resolve, reject) => {
      evm.runCode(
        {
          code: Buffer.from(code.join(''), 'hex'),
          data: Buffer.from(data, 'hex'),
          gasLimit: Buffer.from(
            (gasLimit || OP.BLOCK_GAS_LIMIT).toString(16).replace('0x', ''),
            'hex'
          ),
          gasPrice: 0,
          caller: DEFAULT_CALLER,
          origin: DEFAULT_CALLER,
          address: DEFAULT_CONTRACT_ADDRESS,
          block: defaultBlock,
          pc: context.pc,
        },
        (err, res) => {
          if (err) {
            // we handle execution errors further below
          }

          let _stack = toHex(res.runState.stack);
          let _mem = Buffer.from(res.runState.memory).toString('hex');
          let pc = res.runState.programCounter;
          let gasLeft = res.runState.gasLeft;
          let returnData = res.return;

          while ((_mem.length % 64) !== 0) {
            _mem += '00';
          }

          this._finishPrevStep(context, _stack, _mem, pc, gasLeft, returnData, res.exceptionError);

          let len = context.steps.length;
          let prevLogHash = logHash ? logHash.replace('0x', '') : ZERO_HASH;
          for (let i = 0; i < len; i++) {
            const step = context.steps[i];

            step.input.logHash = prevLogHash;

            if (step.opcodeName.startsWith('LOG')) {
              let log = res.logs.pop();

              if (!log) {
                throw new Error('step with LOGx opcode but no log emitted');
              }
              step.log = log;

              let topics = log[1];
              while (topics.length !== 4) {
                topics.push(0);
              }
              let hash = ethers.utils.solidityKeccak256(
                ['bytes32', 'address', 'uint[4]', 'bytes'],
                [
                  '0x' + prevLogHash,
                  '0x' + log[0].toString('hex'),
                  topics,
                  '0x' + log[2].toString('hex'),
                ]
              ).replace('0x', '');

              step.output.logHash = hash;
              prevLogHash = hash;
              continue;
            }

            step.output.logHash = prevLogHash;
          }

          resolve(context.steps);
        }
      );
    });

    let i = steps.length;
    while (i--) {
      steps[i].accounts = await this.dumpTouchedAccounts(evm);

      await new Promise(
        (resolve, reject) => {
          evm.stateManager.revert(
            () => {
              resolve(true);
            }
          );
        }
      );
    }

    return steps;
  }
}
