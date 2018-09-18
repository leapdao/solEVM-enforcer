import { hexRange, range, pushRange } from './utils';

const OP = require('./helpers/constants');

const stack16 = pushRange(1, 16);

export default [
  [OP.PUSH1, '3', OP.PUSH1, '5', OP.ADD],
  [OP.PUSH1, '3', OP.PUSH1, '5', OP.MUL],
  [OP.PUSH1, '5', OP.PUSH1, '3', OP.SUB],
  [OP.PUSH1, '6', OP.PUSH1, '3', OP.DIV],
  [OP.PUSH1, '6', OP.PUSH1, '3', OP.SDIV],
  [OP.PUSH1, '7', OP.PUSH1, '3', OP.MOD],
  [OP.PUSH1, '8', OP.PUSH1, '3', OP.SMOD],
  [OP.PUSH1, '5', OP.PUSH1, '3', OP.PUSH1, '5', OP.ADDMOD],
  [OP.PUSH1, '6', OP.PUSH1, '3', OP.PUSH1, '3', OP.MULMOD],
  [OP.PUSH1, '5', OP.PUSH1, '3', OP.EXP],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.SIGNEXTEND],

  // 1x - Comparison & bitwise logic
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.PUSH1, '5', OP.LT],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.GT],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.SLT],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.SGT],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.EQ],
  [OP.PUSH1, '2', OP.ISZERO],
  [OP.PUSH1, 0x11, OP.PUSH1, 0x10, OP.AND],
  [OP.PUSH1, 0x101, OP.PUSH1, 0x100, OP.OR],
  [OP.PUSH1, 0x101, OP.PUSH1, 0x100, OP.XOR],
  [OP.PUSH32, '0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe', OP.NOT],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.BYTE],
  // TODO: need to compile for Constantinople
  // [0x0001, 2, OP.SHL],
  // [0x0001, 2, OP.SHR],,
  // [0x0001, 2, OP.SAR],
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.POP],
  // 8x Duplication
  [OP.PUSH1, '2', OP.DUP1],
  [...stack16, OP.DUP2],
  [...stack16, OP.DUP3],
  [...stack16, OP.DUP4],
  [...stack16, OP.DUP5],
  [...stack16, OP.DUP6],
  [...stack16, OP.DUP7],
  [...stack16, OP.DUP8],
  [...stack16, OP.DUP9],
  [...stack16, OP.DUP10],
  [...stack16, OP.DUP11],
  [...stack16, OP.DUP12],
  [...stack16, OP.DUP13],
  [...stack16, OP.DUP14],
  [...stack16, OP.DUP15],
  [...stack16, OP.DUP16],
  // 9x Exchange
  [OP.PUSH1, '2', OP.PUSH1, '3', OP.SWAP1],
  [...stack16, OP.SWAP2],
  [...stack16, OP.SWAP3],
  [...stack16, OP.SWAP4],
  [...stack16, OP.SWAP5],
  [...stack16, OP.SWAP6],
  [...stack16, OP.SWAP7],
  [...stack16, OP.SWAP8],
  [...stack16, OP.SWAP9],
  [...stack16, OP.SWAP10],
  [...stack16, OP.SWAP11],
  [...stack16, OP.SWAP12],
  [...stack16, OP.SWAP13],
  [...stack16, OP.SWAP14],
  [...stack16, OP.SWAP15],
  [...stack16, OP.SWAP16],

  // Context and stack opcodes

  { code: [OP.PUSH20, '0x4ae7b3e204fed41c82d57ecd2242470196d70d02', OP.BALANCE],
    accounts: [
      {
        address: '0x4ae7b3e204fed41c82d57ecd2242470196d70d02',
        balance: 254,
        storage: [{ address: 0, value: 5 }, { address: 1, value: 6 }],
      },
    ],
  },
  [OP.GASPRICE, OP.POP, OP.ADDRESS],
  [OP.GASPRICE, OP.POP, OP.ORIGIN],
  [OP.GASPRICE, OP.POP, OP.CALLER],
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  [OP.GASPRICE, OP.POP, OP.CALLVALUE],
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  [OP.GASPRICE, OP.POP, OP.GASPRICE],
  [OP.GASPRICE, OP.POP, OP.BLOCKHASH],
  [OP.GASPRICE, OP.POP, OP.COINBASE],
  [OP.GASPRICE, OP.POP, OP.TIMESTAMP],
  [OP.GASPRICE, OP.POP, OP.NUMBER],
  [OP.GASPRICE, OP.POP, OP.DIFFICULTY],
  [OP.GASPRICE, OP.POP, OP.GASLIMIT],
  { code: [OP.GASPRICE, OP.PC, OP.POP], pc: 1 }, // PC
  { code: [OP.GASPRICE, OP.GAS, OP.POP], pc: 1 }, // GAS

  { code: [OP.PUSH1, 0, OP.JUMPDEST, OP.PUSH1, '04', OP.JUMP, OP.JUMPDEST], pc: '3' },
  [OP.PUSH1, 0, OP.PUSH1, 0, OP.PUSH1, '00', OP.PUSH1, '00', OP.JUMPI],

  // poor test
  // TODO: init state with returnData first
  [0, OP.RETURNDATASIZE],

  //  Code and stack opcodes (CODESIZE, PUSH1 - PUSH32)
  [1, OP.CODESIZE],
];
