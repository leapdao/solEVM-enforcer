import { range, leftPad, pushRange } from './utils';

const OP = require('./helpers/constants');

const stack16 = pushRange(1, 16);

export default [
  [OP.PUSH1, '03', OP.PUSH1, '05', OP.ADD],
  [OP.PUSH1, '03', OP.PUSH1, '05', OP.MUL],
  [OP.PUSH1, '05', OP.PUSH1, '03', OP.SUB],
  [OP.PUSH1, '06', OP.PUSH1, '03', OP.DIV],
  [OP.PUSH1, '06', OP.PUSH1, '03', OP.SDIV],
  [OP.PUSH1, '07', OP.PUSH1, '03', OP.MOD],
  [OP.PUSH1, '08', OP.PUSH1, '03', OP.SMOD],
  [OP.PUSH1, '05', OP.PUSH1, '03', OP.PUSH1, '05', OP.ADDMOD],
  [OP.PUSH1, '06', OP.PUSH1, '03', OP.PUSH1, '03', OP.MULMOD],
  [OP.PUSH1, '05', OP.PUSH1, '03', OP.EXP],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.SIGNEXTEND],

  // // 1x - Comparison & bitwise logic
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.PUSH1, '05', OP.LT],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.GT],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.SLT],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.SGT],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.EQ],
  [OP.PUSH1, '02', OP.ISZERO],
  [OP.PUSH1, 0xfd, OP.PUSH1, 0xfc, OP.AND],
  [OP.PUSH1, 0xfd, OP.PUSH1, 0xfc, OP.OR],
  [OP.PUSH1, 0xfd, OP.PUSH1, 0xff, OP.XOR],
  [OP.PUSH1, 'fe', OP.NOT],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.BYTE],
  // TODO: need to compile for Constantinople
  // [0x0001, 2, OP.SHL],
  // [0x0001, 2, OP.SHR],,
  // [0x0001, 2, OP.SAR],
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.POP],
  // 8x Duplication
  [OP.PUSH1, '02', OP.DUP1],
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
  [OP.PUSH1, '02', OP.PUSH1, '03', OP.SWAP1],
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

  [OP.PUSH20, '4ae7b3e204fed41c82d57ecd2242470196d70d02', OP.BALANCE],
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

  { code: [OP.PUSH1, '00', OP.JUMPDEST, OP.PUSH1, '04', OP.JUMP, OP.JUMPDEST], pc: 5 },
  [OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.JUMPI],

  // poor test
  // TODO: init state with returnData first
  [0, OP.RETURNDATASIZE],

  //  Code and stack opcodes (CODESIZE, PUSH1 - PUSH32)
  [1, OP.CODESIZE],
  { code: [OP.GASPRICE, OP.POP, OP.PUSH1, '01', OP.POP], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH2, '01', '02'], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH3, '01', '02', '03'], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH4, ...range(10, 13)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH5, ...range(10, 14)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH6, ...range(10, 15)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH7, ...range(10, 16)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH8, ...range(10, 17)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH9, ...range(10, 18)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH10, ...range(10, 19)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH11, ...range(10, 20)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH12, ...range(10, 21)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH13, ...range(10, 22)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH14, ...range(10, 23)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH15, ...range(10, 24)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH16, ...range(10, 25)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH17, ...range(10, 26)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH18, ...range(10, 27)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH19, ...range(10, 28)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH20, ...range(10, 29)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH21, ...range(10, 30)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH22, ...range(10, 31)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH23, ...range(10, 32)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH24, ...range(10, 33)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH25, ...range(10, 34)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH26, ...range(10, 35)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH27, ...range(10, 36)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH28, ...range(10, 37)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH29, ...range(10, 38)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH30, ...range(10, 39)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH31, ...range(10, 40)], pc: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH32, ...range(10, 41)], pc: 2 },

  // Data and stack opcodes
  
  { code: [OP.PUSH1, '01', OP.CALLDATALOAD], data: '0x123456' },
  { code: [OP.GASPRICE, OP.POP, OP.CALLDATASIZE], data: '0x1234' },
  
  // Memory and stack (MLOAD, MSTORE, MSTORE8, MSIZE)
  // MSTORE
  {
    code: [ OP.PUSH32, leftPad('5567', 64), OP.PUSH1, '01', OP.MSTORE, OP.PUSH1, '01', OP.MLOAD, OP.POP, OP.MSIZE ],
    pc: 35
  },
  // MLOAD
  {
    code: [ OP.PUSH32, leftPad('5567', 64), OP.PUSH1, '01', OP.MSTORE, OP.PUSH1, '01', OP.MLOAD, OP.POP, OP.MSIZE ],
    pc: 38
  },
  // MSTORE8
  {
    code: [ OP.PUSH32, leftPad('5567', 64), OP.PUSH1, '01', OP.MSTORE8, OP.MSIZE ],
    pc: 35
  },
  // MSIZE
  [ OP.PUSH32, leftPad('5567', 64), OP.PUSH1, '01', OP.MSTORE8, OP.MSIZE ],
  
  // Data, stack and memory type OP-codes (CALLDATACOPY)
  {
    code: [OP.PUSH1, '01', OP.PUSH1, '03', OP.PUSH1, '04', OP.CALLDATACOPY],
    data: '0x06397872cdd21945455a7fdc7921e2db7bd8e402607cad66279e899f6ae9b1da'
  },
    
  // Code, stack and memory type OP-codes (CODECOPY)
  [OP.PUSH1, '02', OP.PUSH1, '01', OP.PUSH1, '01', OP.CODECOPY],
  
  // Storage and stack (SSTORE, SLOAD)
  [OP.PUSH1, '00', OP.PUSH1, '05', OP.SSTORE],
  [OP.PUSH1, '00', OP.PUSH1, '05', OP.SSTORE, OP.PUSH1, '00', OP.SLOAD],
  
  // Context, stack and memory type OP-codes (LOG)
  [
    OP.PUSH32, '0102030405060708091011121314151617181920212223242526272829303132', OP.PUSH1, '00', OP.MSTORE,
    OP.PUSH1, '04', OP.PUSH1, '04', OP.LOG0,
  ],
  [
    OP.PUSH32, '0102030405060708091011121314151617181920212223242526272829303132', OP.PUSH1, '00', OP.MSTORE,
    OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG1,
  ],
  [
    OP.PUSH32, '0102030405060708091011121314151617181920212223242526272829303132', OP.PUSH1, '00', OP.MSTORE,
    OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG2,
  ],
  [
    OP.PUSH32, '0102030405060708091011121314151617181920212223242526272829303132', OP.PUSH1, '00', OP.MSTORE,
    OP.PUSH1, '07', OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG3,
  ],
  [
    OP.PUSH32, '0102030405060708091011121314151617181920212223242526272829303132', OP.PUSH1, '00', OP.MSTORE,
    OP.PUSH1, '08', OP.PUSH1, '07', OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG4,
  ],

  // Return, Stack and Memory type OP-codes (RETURN, REVERT, RETURNDATACOPY)
  [OP.PUSH1, '00', OP.PUSH1, '00', OP.RETURN],
  [OP.PUSH1, '00', OP.PUSH1, '00', OP.REVERT],
  [OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.RETURNDATACOPY],
];
