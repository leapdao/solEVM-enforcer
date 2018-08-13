import { BLOCK_GAS_LIMIT } from './helpers/constants';

const OP = require('./helpers/constants');

const DEFAULT_CONTRACT_ADDRESS = `0x${OP.DEFAULT_CONTRACT_ADDRESS}`;
const DEFAULT_CALLER_ADDRESS = `0x${OP.DEFAULT_CALLER}`;

const range = (from, to) => Array.from({ length: to - from + 1 }, (x, i) => i + from);

const stack16 = range(1, 16);

export default [

  // 0x - arithmetic ops
  { opcode: OP.ADD, stack: ['3', '5'], result: { stack: [8], gasUsed: 3 } },
  { opcode: OP.MUL, stack: ['3', '5'], result: { stack: [15], gasUsed: 5 } },
  { opcode: OP.SUB, stack: ['3', '5'], result: { stack: [2], gasUsed: 3 } },
  { opcode: OP.DIV, stack: ['3', '6'], result: { stack: [2], gasUsed: 5 } },
  { opcode: OP.SDIV, stack: ['3', '6'], result: { stack: [2], gasUsed: 5 } },
  { opcode: OP.MOD, stack: ['3', '7'], result: { stack: [1], gasUsed: 5 } },
  { opcode: OP.SMOD, stack: ['3', '8'], result: { stack: [2], gasUsed: 5 } },
  { opcode: OP.ADDMOD, stack: ['5', '3', '5'], result: { stack: [3], gasUsed: 8 } },
  { opcode: OP.MULMOD, stack: ['4', '3', '6'], result: { stack: [2], gasUsed: 8 } },
  { opcode: OP.EXP, stack: ['3', '5'], result: { stack: [125], gasUsed: 10 } },
  { opcode: OP.SIGNEXTEND, stack: ['3', '2'], result: { stack: [3], gasUsed: 5 } },

  // 1x - Comparison & bitwise logic
  { opcode: OP.LT, stack: ['5', '3', '2'], result: { stack: [5, 1], gasUsed: 3 } },
  { opcode: OP.GT, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { opcode: OP.SLT, stack: ['3', '2'], result: { stack: [1], gasUsed: 3 } },
  { opcode: OP.SGT, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { opcode: OP.EQ, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { opcode: OP.ISZERO, stack: ['2'], result: { stack: [0], gasUsed: 3 } },
  { opcode: OP.AND, stack: [0x11, 0x10], result: { stack: [parseInt('0x10', 16)], gasUsed: 3 } },
  { opcode: OP.OR, stack: [0x101, 0x100], result: { stack: [parseInt('0x101', 16)], gasUsed: 3 } },
  { opcode: OP.XOR, stack: [0x101, 0x100], result: { stack: [parseInt('0x1', 16)], gasUsed: 3 } },
  {
    opcode: OP.NOT,
    stack: ['0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe'],
    result: { stack: [1], gasUsed: 3 },
  },
  { opcode: OP.BYTE, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  // TODO: need to compile for Constantinople
  // { opcode: OP.SHL, stack: [0x0001, 2], result: { stack: [parseInt('0x01', 16)] } },
  // { opcode: OP.SHR, stack: [0x1000, 2], result: { stack: [parseInt('0x001', 16)] } },
  // { opcode: OP.SAR, stack: [0x1000, 2], result: { stack: [1] } },
  { opcode: OP.POP, stack: ['2', '3'], result: { stack: [2], gasUsed: 2 } },
  // 8x Duplication
  { opcode: OP.DUP1, stack: ['2'], result: { stack: [2, 2], gasUsed: 3 } },
  { opcode: OP.DUP2, stack: stack16, result: { stack: [...stack16, 15], gasUsed: 3 } },
  { opcode: OP.DUP3, stack: stack16, result: { stack: [...stack16, 14], gasUsed: 3 } },
  { opcode: OP.DUP4, stack: stack16, result: { stack: [...stack16, 13], gasUsed: 3 } },
  { opcode: OP.DUP5, stack: stack16, result: { stack: [...stack16, 12], gasUsed: 3 } },
  { opcode: OP.DUP6, stack: stack16, result: { stack: [...stack16, 11], gasUsed: 3 } },
  { opcode: OP.DUP7, stack: stack16, result: { stack: [...stack16, 10], gasUsed: 3 } },
  { opcode: OP.DUP8, stack: stack16, result: { stack: [...stack16, 9], gasUsed: 3 } },
  { opcode: OP.DUP9, stack: stack16, result: { stack: [...stack16, 8], gasUsed: 3 } },
  { opcode: OP.DUP10, stack: stack16, result: { stack: [...stack16, 7], gasUsed: 3 } },
  { opcode: OP.DUP11, stack: stack16, result: { stack: [...stack16, 6], gasUsed: 3 } },
  { opcode: OP.DUP12, stack: stack16, result: { stack: [...stack16, 5], gasUsed: 3 } },
  { opcode: OP.DUP13, stack: stack16, result: { stack: [...stack16, 4], gasUsed: 3 } },
  { opcode: OP.DUP14, stack: stack16, result: { stack: [...stack16, 3], gasUsed: 3 } },
  { opcode: OP.DUP15, stack: stack16, result: { stack: [...stack16, 2], gasUsed: 3 } },
  { opcode: OP.DUP16, stack: stack16, result: { stack: [...stack16, 1], gasUsed: 3 } },
  // 9x Exchange
  { opcode: OP.SWAP1, stack: ['3', '2'], result: { stack: [2, 3], gasUsed: 3 } },
  { opcode: OP.SWAP2, stack: range(1, 3), result: { stack: [3, ...range(2, 2), 1], gasUsed: 3 } },
  { opcode: OP.SWAP3, stack: range(1, 4), result: { stack: [4, ...range(2, 3), 1], gasUsed: 3 } },
  { opcode: OP.SWAP4, stack: range(1, 5), result: { stack: [5, ...range(2, 4), 1], gasUsed: 3 } },
  { opcode: OP.SWAP5, stack: range(1, 6), result: { stack: [6, ...range(2, 5), 1], gasUsed: 3 } },
  { opcode: OP.SWAP6, stack: range(1, 7), result: { stack: [7, ...range(2, 6), 1], gasUsed: 3 } },
  { opcode: OP.SWAP7, stack: range(1, 8), result: { stack: [8, ...range(2, 7), 1], gasUsed: 3 } },
  { opcode: OP.SWAP8, stack: range(1, 9), result: { stack: [9, ...range(2, 8), 1], gasUsed: 3 } },
  { opcode: OP.SWAP9, stack: range(1, 10), result: { stack: [10, ...range(2, 9), 1], gasUsed: 3 } },
  { opcode: OP.SWAP10, stack: range(1, 11), result: { stack: [11, ...range(2, 10), 1], gasUsed: 3 } },
  { opcode: OP.SWAP11, stack: range(1, 12), result: { stack: [12, ...range(2, 11), 1], gasUsed: 3 } },
  { opcode: OP.SWAP12, stack: range(1, 13), result: { stack: [13, ...range(2, 12), 1], gasUsed: 3 } },
  { opcode: OP.SWAP13, stack: range(1, 14), result: { stack: [14, ...range(2, 13), 1], gasUsed: 3 } },
  { opcode: OP.SWAP14, stack: range(1, 15), result: { stack: [15, ...range(2, 14), 1], gasUsed: 3 } },
  { opcode: OP.SWAP15, stack: range(1, 16), result: { stack: [16, ...range(2, 15), 1], gasUsed: 3 } },
  { opcode: OP.SWAP16, stack: range(1, 17), result: { stack: [17, ...range(2, 16), 1], gasUsed: 3 } },

  { opcode: OP.BALANCE,
    stack: ['0x4ae7b3e204fed41c82d57ecd2242470196d70d02'],
    accounts: { '0x4ae7b3e204fed41c82d57ecd2242470196d70d02': 254 },
    result: { stack: [254], gasUsed: 400 },
  },
  { opcode: OP.ADDRESS, result: { stack: [parseInt(DEFAULT_CONTRACT_ADDRESS, 16)], gasUsed: 2 } },
  { opcode: OP.ORIGIN, result: { stack: [parseInt(DEFAULT_CALLER_ADDRESS, 16)], gasUsed: 2 } },
  { opcode: OP.CALLER, result: { stack: [parseInt(DEFAULT_CALLER_ADDRESS, 16)], gasUsed: 2 } },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { opcode: OP.CALLVALUE, result: { stack: [0], gasUsed: 2 } },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { opcode: OP.GASPRICE, result: { stack: [0], gasUsed: 2 } },
  { opcode: OP.BLOCKHASH, result: { stack: [], gasUsed: 20 } },
  { opcode: OP.COINBASE, result: { stack: [0], gasUsed: 2 } },
  { opcode: OP.TIMESTAMP, result: { stack: [0], gasUsed: 2 } },
  { opcode: OP.NUMBER, result: { stack: [0], gasUsed: 2 } },
  { opcode: OP.DIFFICULTY, result: { stack: [0], gasUsed: 2 } },
  { opcode: OP.GASLIMIT, result: { stack: [parseInt(BLOCK_GAS_LIMIT, 16)], gasUsed: 2 } },
  { opcode: OP.GASLIMIT, gasLimit: 100, result: { stack: [100], gasUsed: 2 } },
  { opcode: [OP.GASPRICE, OP.POP, OP.PC], result: { stack: [2], gasUsed: 6 } }, // PC
  { opcode: [OP.GASPRICE, OP.POP, OP.GAS], gasLimit: 10, result: { stack: [6], gasUsed: 4 } }, // GAS

  // JUMP, infinite loop
  { opcode: [OP.PUSH1, '01', OP.JUMP], stack: [0], result: { stack: [], pc: 0, gasUsed: 11 } },
  // JUMPI, inifite loop
  { opcode: [OP.PUSH1, '01', OP.PUSH1, '00', OP.JUMPI], stack: [1, 0], result: { stack: [], pc: 0, gasUsed: 16 } },
  { opcode: [OP.PUSH1, '00', OP.PUSH1, '00', OP.JUMPI], stack: [0, 0], result: { stack: [], pc: 5, gasUsed: 16 } },

];
