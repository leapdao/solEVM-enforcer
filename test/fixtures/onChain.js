
const { range, leftPad, pushRange } = require('./../helpers/utils');
const OP = require('./../../utils/constants');

const stack16 = pushRange(1, 16);

function split (str) {
  const res = [];

  for (let i = 0; i < str.length; i += 2) {
    res.push(str.substring(i, i + 2));
  }

  return res;
}

module.exports = [
  { code: [OP.PUSH1, '03', OP.PUSH1, '05', OP.ADD], step: 2 },
  { code: [OP.PUSH1, '03', OP.PUSH1, '05', OP.MUL], step: 2 },
  { code: [OP.PUSH1, '05', OP.PUSH1, '03', OP.SUB], step: 2 },
  { code: [OP.PUSH1, '06', OP.PUSH1, '03', OP.DIV], step: 2 },
  { code: [OP.PUSH1, '06', OP.PUSH1, '03', OP.SDIV], step: 2 },
  { code: [OP.PUSH1, '07', OP.PUSH1, '03', OP.MOD], step: 2 },
  { code: [OP.PUSH1, '08', OP.PUSH1, '03', OP.SMOD], step: 2 },
  { code: [OP.PUSH1, '05', OP.PUSH1, '03', OP.PUSH1, '05', OP.ADDMOD], step: 3 },
  { code: [OP.PUSH1, '06', OP.PUSH1, '03', OP.PUSH1, '03', OP.MULMOD], step: 3 },
  { code: [OP.PUSH1, '05', OP.PUSH1, '03', OP.EXP], step: 2 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.SIGNEXTEND], step: 2 },

  // // 1x - Comparison & bitwise logic
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.PUSH1, '05', OP.LT], step: 3 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.GT], step: 2 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.SLT], step: 2 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.SGT], step: 2 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.EQ], step: 2 },
  { code: [OP.PUSH1, '02', OP.ISZERO], step: 1 },
  { code: [OP.PUSH1, 0xfd, OP.PUSH1, 0xfc, OP.AND], step: 2 },
  { code: [OP.PUSH1, 0xfd, OP.PUSH1, 0xfc, OP.OR], step: 2 },
  { code: [OP.PUSH1, 0xfd, OP.PUSH1, 0xff, OP.XOR], step: 2 },
  { code: [OP.PUSH1, 'fe', OP.NOT], step: 1 },
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.BYTE], step: 2 },
  // TODO: need to compile for Constantinople
  // [0x0001, 2, OP.SHL],
  // [0x0001, 2, OP.SHR],,
  // [0x0001, 2, OP.SAR],
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.POP], step: 2 },
  // 8x Duplication
  { code: [OP.PUSH1, '02', OP.DUP1], step: 1 },
  { code: [...stack16, OP.DUP2], step: 16 },
  { code: [...stack16, OP.DUP3], step: 16 },
  { code: [...stack16, OP.DUP4], step: 16 },
  { code: [...stack16, OP.DUP5], step: 16 },
  { code: [...stack16, OP.DUP6], step: 16 },
  { code: [...stack16, OP.DUP7], step: 16 },
  { code: [...stack16, OP.DUP8], step: 16 },
  { code: [...stack16, OP.DUP9], step: 16 },
  { code: [...stack16, OP.DUP10], step: 16 },
  { code: [...stack16, OP.DUP11], step: 16 },
  { code: [...stack16, OP.DUP12], step: 16 },
  { code: [...stack16, OP.DUP13], step: 16 },
  { code: [...stack16, OP.DUP14], step: 16 },
  { code: [...stack16, OP.DUP15], step: 16 },
  { code: [...stack16, OP.DUP16], step: 16 },
  // 9x Exchange
  { code: [OP.PUSH1, '02', OP.PUSH1, '03', OP.SWAP1], step: 2 },
  { code: [...stack16, OP.SWAP2], step: 16 },
  { code: [...stack16, OP.SWAP3], step: 16 },
  { code: [...stack16, OP.SWAP4], step: 16 },
  { code: [...stack16, OP.SWAP5], step: 16 },
  { code: [...stack16, OP.SWAP6], step: 16 },
  { code: [...stack16, OP.SWAP7], step: 16 },
  { code: [...stack16, OP.SWAP8], step: 16 },
  { code: [...stack16, OP.SWAP9], step: 16 },
  { code: [...stack16, OP.SWAP10], step: 16 },
  { code: [...stack16, OP.SWAP11], step: 16 },
  { code: [...stack16, OP.SWAP12], step: 16 },
  { code: [...stack16, OP.SWAP13], step: 16 },
  { code: [...stack16, OP.SWAP14], step: 16 },
  { code: [...stack16, OP.SWAP15], step: 16 },
  { code: [...stack16, OP.SWAP16], step: 16 },

  // Context and stack opcodes

  { code: [OP.PUSH20, ...split('4ae7b3e204fed41c82d57ecd2242470196d70d02'), OP.BALANCE], step: 1 },
  { code: [OP.GASPRICE, OP.POP, OP.ADDRESS], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.ORIGIN], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.CALLER], step: 2 },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { code: [OP.GASPRICE, OP.POP, OP.CALLVALUE], step: 2 },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { code: [OP.GASPRICE, OP.POP, OP.GASPRICE], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.BLOCKHASH], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.COINBASE], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.TIMESTAMP], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.NUMBER], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.DIFFICULTY], step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.GASLIMIT], step: 2 },
  { code: [OP.GASPRICE, OP.PC, OP.POP], pc: 1, step: 1 }, // PC
  { code: [OP.GASPRICE, OP.GAS, OP.POP], pc: 1, step: 1 }, // GAS

  { code: [OP.PUSH1, '00', OP.JUMPDEST, OP.PUSH1, '04', OP.JUMP, OP.JUMPDEST], pc: 5, step: 3 },
  { code: [OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.JUMPI], step: 4 },

  // still poor test
  // TODO: init state with returnData first
  { code: [OP.PUSH1, '00', OP.RETURNDATASIZE], step: 1 },

  //  Code and stack opcodes (CODESIZE, PUSH1 - PUSH32)
  { code: [OP.PUSH1, '00', OP.CODESIZE], step: 1 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH1, '01', OP.POP], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH2, '01', '02'], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH3, '01', '02', '03'], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH4, ...range(10, 13)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH5, ...range(10, 14)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH6, ...range(10, 15)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH7, ...range(10, 16)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH8, ...range(10, 17)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH9, ...range(10, 18)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH10, ...range(10, 19)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH11, ...range(10, 20)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH12, ...range(10, 21)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH13, ...range(10, 22)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH14, ...range(10, 23)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH15, ...range(10, 24)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH16, ...range(10, 25)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH17, ...range(10, 26)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH18, ...range(10, 27)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH19, ...range(10, 28)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH20, ...range(10, 29)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH21, ...range(10, 30)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH22, ...range(10, 31)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH23, ...range(10, 32)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH24, ...range(10, 33)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH25, ...range(10, 34)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH26, ...range(10, 35)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH27, ...range(10, 36)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH28, ...range(10, 37)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH29, ...range(10, 38)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH30, ...range(10, 39)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH31, ...range(10, 40)], pc: 2, step: 2 },
  { code: [OP.GASPRICE, OP.POP, OP.PUSH32, ...range(10, 41)], pc: 2, step: 2 },

  // Data and stack opcodes

  { code: [OP.PUSH1, '01', OP.CALLDATALOAD], data: '0x123456', step: 1 },
  { code: [OP.GASPRICE, OP.POP, OP.CALLDATASIZE], data: '0x1234', step: 2 },

  // Memory and stack (MLOAD, MSTORE, MSTORE8, MSIZE)
  // MSTORE
  {
    code: [
      OP.PUSH32,
      ...split(leftPad('5567', 64)),
      OP.PUSH1, '01', OP.MSTORE, OP.PUSH1, '01', OP.MLOAD, OP.POP, OP.MSIZE,
    ],
    pc: 35,
    step: 2,
  },
  // MLOAD
  {
    code: [
      OP.PUSH32,
      ...split(leftPad('5567', 64)),
      OP.PUSH1, '01', OP.MSTORE, OP.PUSH1, '01', OP.MLOAD, OP.POP, OP.MSIZE,
    ],
    pc: 38,
    step: 4,
  },
  // MSTORE8
  {
    code: [ OP.PUSH32, ...split(leftPad('5567', 64)), OP.PUSH1, '01', OP.MSTORE8, OP.MSIZE ],
    pc: 35,
    step: 2,
  },
  // MSIZE
  { code: [ OP.PUSH32, ...split(leftPad('5567', 64)), OP.PUSH1, '01', OP.MSTORE8, OP.MSIZE ], step: 3 },

  // Data, stack and memory type OP-codes (CALLDATACOPY)
  {
    code: [OP.PUSH1, '01', OP.PUSH1, '03', OP.PUSH1, '04', OP.CALLDATACOPY],
    data: '0x06397872cdd21945455a7fdc7921e2db7bd8e402607cad66279e899f6ae9b1da',
    step: 3,
  },

  // Code, stack and memory type OP-codes (CODECOPY)
  { code: [OP.PUSH1, '02', OP.PUSH1, '01', OP.PUSH1, '01', OP.CODECOPY], step: 3 },

  // Storage and stack (SSTORE, SLOAD)
  { code: [OP.PUSH1, '00', OP.PUSH1, '05', OP.SSTORE], step: 2 },
  { code: [OP.PUSH1, '00', OP.PUSH1, '05', OP.SSTORE, OP.PUSH1, '00', OP.SLOAD], step: 4 },

  // Context, stack and memory type OP-codes (LOG)
  {
    code: [
      OP.PUSH32,
      ...split('0102030405060708091011121314151617181920212223242526272829303132'),
      OP.PUSH1, '00', OP.MSTORE,
      OP.PUSH1, '04', OP.PUSH1, '04', OP.LOG0,
    ],
    step: 5,
  },
  {
    code: [
      OP.PUSH32,
      ...split('0102030405060708091011121314151617181920212223242526272829303132'),
      OP.PUSH1, '00', OP.MSTORE,
      OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG1,
    ],
    step: 6,
  },
  {
    code: [
      OP.PUSH32,
      ...split('0102030405060708091011121314151617181920212223242526272829303132'),
      OP.PUSH1, '00', OP.MSTORE,
      OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG2,
    ],
    step: 7,
  },
  {
    code: [
      OP.PUSH32,
      ...split('0102030405060708091011121314151617181920212223242526272829303132'),
      OP.PUSH1, '00', OP.MSTORE,
      OP.PUSH1, '07', OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG3,
    ],
    step: 8,
  },
  {
    code: [
      OP.PUSH32,
      ...split('0102030405060708091011121314151617181920212223242526272829303132'),
      OP.PUSH1, '00', OP.MSTORE,
      OP.PUSH1, '08', OP.PUSH1, '07', OP.PUSH1, '06', OP.PUSH1, '05', OP.PUSH1, '04', OP.PUSH1, '02', OP.LOG4,
    ],
    step: 9,
  },

  // Return, Stack and Memory type OP-codes (RETURN, REVERT, RETURNDATACOPY)
  { code: [OP.PUSH1, '00', OP.PUSH1, '00', OP.RETURN], step: 2 },
  { code: [OP.PUSH1, '00', OP.PUSH1, '00', OP.REVERT], step: 2 },
  { code: [OP.PUSH1, '00', OP.PUSH1, '00', OP.PUSH1, '00', OP.RETURNDATACOPY], step: 3 },
];
