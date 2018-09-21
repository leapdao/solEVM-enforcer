import { BLOCK_GAS_LIMIT } from './helpers/constants';
import { hexRange, range } from './utils';

const OP = require('./helpers/constants');

const DEFAULT_CONTRACT_ADDRESS = `0x${OP.DEFAULT_CONTRACT_ADDRESS}`;
const DEFAULT_CALLER_ADDRESS = `0x${OP.DEFAULT_CALLER}`;

const stack16 = range(1, 16);

export default [

  // 0x - arithmetic ops
  { code: OP.ADD, stack: ['3', '5'], result: { stack: [8], gasUsed: 3 } },
  { code: OP.MUL, stack: ['3', '5'], result: { stack: [15], gasUsed: 5 } },
  { code: OP.SUB, stack: ['3', '5'], result: { stack: [2], gasUsed: 3 } },
  { code: OP.DIV, stack: ['3', '6'], result: { stack: [2], gasUsed: 5 } },
  { code: OP.SDIV, stack: ['3', '6'], result: { stack: [2], gasUsed: 5 } },
  { code: OP.MOD, stack: ['3', '7'], result: { stack: [1], gasUsed: 5 } },
  { code: OP.SMOD, stack: ['3', '8'], result: { stack: [2], gasUsed: 5 } },
  { code: OP.ADDMOD, stack: ['5', '3', '5'], result: { stack: [3], gasUsed: 8 } },
  { code: OP.MULMOD, stack: ['4', '3', '6'], result: { stack: [2], gasUsed: 8 } },
  { code: OP.EXP, stack: ['3', '5'], result: { stack: [125], gasUsed: 10 } },
  { code: OP.SIGNEXTEND, stack: ['3', '2'], result: { stack: [3], gasUsed: 5 } },

  // 1x - Comparison & bitwise logic
  { code: OP.LT, stack: ['5', '3', '2'], result: { stack: [5, 1], gasUsed: 3 } },
  { code: OP.GT, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { code: OP.SLT, stack: ['3', '2'], result: { stack: [1], gasUsed: 3 } },
  { code: OP.SGT, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { code: OP.EQ, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  { code: OP.ISZERO, stack: ['2'], result: { stack: [0], gasUsed: 3 } },
  { code: OP.AND, stack: [0xfd, 0xfc], result: { stack: [parseInt('0xfc', 16)], gasUsed: 3 } },
  { code: OP.OR, stack: [0xfd, 0xfc], result: { stack: [parseInt('0xfd', 16)], gasUsed: 3 } },
  { code: OP.XOR, stack: [0xfd, 0xff], result: { stack: [2], gasUsed: 3 } },
  {
    code: OP.NOT,
    stack: ['0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe'],
    result: { stack: [1], gasUsed: 3 },
  },
  { code: OP.BYTE, stack: ['3', '2'], result: { stack: [0], gasUsed: 3 } },
  // TODO: need to compile for Constantinople
  // { code: OP.SHL, stack: [0x0001, 2], result: { stack: [parseInt('0x01', 16)] } },
  // { code: OP.SHR, stack: [0x1000, 2], result: { stack: [parseInt('0x001', 16)] } },
  // { code: OP.SAR, stack: [0x1000, 2], result: { stack: [1] } },
  { code: OP.POP, stack: ['2', '3'], result: { stack: [2], gasUsed: 2 } },
  // 8x Duplication
  { code: OP.DUP1, stack: ['2'], result: { stack: [2, 2], gasUsed: 3 } },
  { code: OP.DUP2, stack: stack16, result: { stack: [...stack16, 15], gasUsed: 3 } },
  { code: OP.DUP3, stack: stack16, result: { stack: [...stack16, 14], gasUsed: 3 } },
  { code: OP.DUP4, stack: stack16, result: { stack: [...stack16, 13], gasUsed: 3 } },
  { code: OP.DUP5, stack: stack16, result: { stack: [...stack16, 12], gasUsed: 3 } },
  { code: OP.DUP6, stack: stack16, result: { stack: [...stack16, 11], gasUsed: 3 } },
  { code: OP.DUP7, stack: stack16, result: { stack: [...stack16, 10], gasUsed: 3 } },
  { code: OP.DUP8, stack: stack16, result: { stack: [...stack16, 9], gasUsed: 3 } },
  { code: OP.DUP9, stack: stack16, result: { stack: [...stack16, 8], gasUsed: 3 } },
  { code: OP.DUP10, stack: stack16, result: { stack: [...stack16, 7], gasUsed: 3 } },
  { code: OP.DUP11, stack: stack16, result: { stack: [...stack16, 6], gasUsed: 3 } },
  { code: OP.DUP12, stack: stack16, result: { stack: [...stack16, 5], gasUsed: 3 } },
  { code: OP.DUP13, stack: stack16, result: { stack: [...stack16, 4], gasUsed: 3 } },
  { code: OP.DUP14, stack: stack16, result: { stack: [...stack16, 3], gasUsed: 3 } },
  { code: OP.DUP15, stack: stack16, result: { stack: [...stack16, 2], gasUsed: 3 } },
  { code: OP.DUP16, stack: stack16, result: { stack: [...stack16, 1], gasUsed: 3 } },
  // 9x Exchange
  { code: OP.SWAP1, stack: ['3', '2'], result: { stack: [2, 3], gasUsed: 3 } },
  { code: OP.SWAP2, stack: range(1, 3), result: { stack: [3, ...range(2, 2), 1], gasUsed: 3 } },
  { code: OP.SWAP3, stack: range(1, 4), result: { stack: [4, ...range(2, 3), 1], gasUsed: 3 } },
  { code: OP.SWAP4, stack: range(1, 5), result: { stack: [5, ...range(2, 4), 1], gasUsed: 3 } },
  { code: OP.SWAP5, stack: range(1, 6), result: { stack: [6, ...range(2, 5), 1], gasUsed: 3 } },
  { code: OP.SWAP6, stack: range(1, 7), result: { stack: [7, ...range(2, 6), 1], gasUsed: 3 } },
  { code: OP.SWAP7, stack: range(1, 8), result: { stack: [8, ...range(2, 7), 1], gasUsed: 3 } },
  { code: OP.SWAP8, stack: range(1, 9), result: { stack: [9, ...range(2, 8), 1], gasUsed: 3 } },
  { code: OP.SWAP9, stack: range(1, 10), result: { stack: [10, ...range(2, 9), 1], gasUsed: 3 } },
  { code: OP.SWAP10, stack: range(1, 11), result: { stack: [11, ...range(2, 10), 1], gasUsed: 3 } },
  { code: OP.SWAP11, stack: range(1, 12), result: { stack: [12, ...range(2, 11), 1], gasUsed: 3 } },
  { code: OP.SWAP12, stack: range(1, 13), result: { stack: [13, ...range(2, 12), 1], gasUsed: 3 } },
  { code: OP.SWAP13, stack: range(1, 14), result: { stack: [14, ...range(2, 13), 1], gasUsed: 3 } },
  { code: OP.SWAP14, stack: range(1, 15), result: { stack: [15, ...range(2, 14), 1], gasUsed: 3 } },
  { code: OP.SWAP15, stack: range(1, 16), result: { stack: [16, ...range(2, 15), 1], gasUsed: 3 } },
  { code: OP.SWAP16, stack: range(1, 17), result: { stack: [17, ...range(2, 16), 1], gasUsed: 3 } },

  // Context and stack opcodes

  { code: OP.BALANCE,
    stack: ['0x4ae7b3e204fed41c82d57ecd2242470196d70d02'],
    accounts: [
      {
        address: '0x4ae7b3e204fed41c82d57ecd2242470196d70d02',
        balance: 254,
        storage: [{ address: 0, value: 5 }, { address: 1, value: 6 }],
      },
    ],
    result: { stack: [254], gasUsed: 400 },
  },
  { code: OP.ADDRESS, result: { stack: [parseInt(DEFAULT_CONTRACT_ADDRESS, 16)], gasUsed: 2 } },
  { code: OP.ORIGIN, result: { stack: [parseInt(DEFAULT_CALLER_ADDRESS, 16)], gasUsed: 2 } },
  { code: OP.CALLER, result: { stack: [parseInt(DEFAULT_CALLER_ADDRESS, 16)], gasUsed: 2 } },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { code: OP.CALLVALUE, result: { stack: [0], gasUsed: 2 } },
  // always 0 in current implementation
  // TODO: do we need it non-zero?
  { code: OP.GASPRICE, result: { stack: [0], gasUsed: 2 } },
  { code: OP.BLOCKHASH, stack: [0], result: { stack: [0], gasUsed: 20 } },
  { code: OP.COINBASE, result: { stack: [0], gasUsed: 2 } },
  { code: OP.TIMESTAMP, result: { stack: [0], gasUsed: 2 } },
  { code: OP.NUMBER, result: { stack: [0], gasUsed: 2 } },
  { code: OP.DIFFICULTY, result: { stack: [0], gasUsed: 2 } },
  { code: OP.GASLIMIT, result: { stack: [parseInt(BLOCK_GAS_LIMIT, 16)], gasUsed: 2 } },
  { code: OP.GASLIMIT, blockGasLimit: 100, result: { stack: [100], gasUsed: 2 } },
  { code: [OP.PC, OP.GASPRICE, OP.POP], pc: '0', result: { stack: [0], gasUsed: 6 } }, // PC
  { code: [OP.GAS, OP.GASPRICE, OP.POP], pc: '0', gasLimit: 10, result: { stack: [8], gasUsed: 6 } }, // GAS

  // invalid JUMP
  {
    code: [OP.PUSH1, '01', OP.JUMP],
    stack: [0],
    result: {
      stack: [],
      pc: 2,
      gasUsed: 8,
      errno: OP.ERROR_INVALID_JUMP_DESTINATION
    }
  },
  // valid JUMP
  {
    code: [OP.JUMPDEST, OP.PUSH1, '04', OP.JUMP, OP.JUMPDEST],
    stack: [0],
    pc: '3',
    result: {
      stack: [],
      pc: 5,
      gasUsed: 21
    }
  },
  // invalid JUMPI
  {
    code: [OP.PUSH1, '01', OP.PUSH1, '00', OP.JUMPI],
    stack: [1, 0],
    result: {
      stack: [],
      pc: 4,
      gasUsed: 10,
      errno: OP.ERROR_INVALID_JUMP_DESTINATION
    }
  },
  // valid JUMPI no-op
  { code: [OP.PUSH1, '00', OP.PUSH1, '00', OP.JUMPI], stack: [0, 0], result: { stack: [], pc: 5, gasUsed: 10 } },

  // poor test
  // TODO: init state with returnData first
  { code: OP.RETURNDATASIZE, result: { stack: [0], gasUsed: 2 } },

  //  Code and stack opcodes (CODESIZE, PUSH1 - PUSH32)
  
  { code: OP.CODESIZE, result: { stack: [1], gasUsed: 2 } },
  { code: [OP.CODESIZE, OP.GASPRICE, OP.POP], pc: '0', result: { stack: [3], gasUsed: 6 } },
  { code: [OP.PUSH1, '01'], pc: '0', result: { stack: [parseInt('01', 16)], gasUsed: 3 } },
  { code: [OP.PUSH2, '01', '02'], pc: '0', result: { stack: [parseInt('0102', 16)], gasUsed: 3 } },
  { code: [OP.PUSH3, '01', '02', '03'], pc: '0', result: { stack: [parseInt('010203', 16)], gasUsed: 3 } },
  { code: [OP.PUSH4, ...range(10, 13)], pc: '0', result: { stack: [hexRange(10, 13)], gasUsed: 3 } },
  { code: [OP.PUSH5, ...range(10, 14)], pc: '0', result: { stack: [hexRange(10, 14)], gasUsed: 3 } },
  { code: [OP.PUSH6, ...range(10, 15)], pc: '0', result: { stack: [hexRange(10, 15)], gasUsed: 3 } },
  { code: [OP.PUSH7, ...range(10, 16)], pc: '0', result: { stack: [hexRange(10, 16)], gasUsed: 3 } },
  { code: [OP.PUSH8, ...range(10, 17)], pc: '0', result: { stack: [hexRange(10, 17)], gasUsed: 3 } },
  { code: [OP.PUSH9, ...range(10, 18)], pc: '0', result: { stack: [hexRange(10, 18)], gasUsed: 3 } },
  { code: [OP.PUSH10, ...range(10, 19)], pc: '0', result: { stack: [hexRange(10, 19)], gasUsed: 3 } },
  { code: [OP.PUSH11, ...range(10, 20)], pc: '0', result: { stack: [hexRange(10, 20)], gasUsed: 3 } },
  { code: [OP.PUSH12, ...range(10, 21)], pc: '0', result: { stack: [hexRange(10, 21)], gasUsed: 3 } },
  { code: [OP.PUSH13, ...range(10, 22)], pc: '0', result: { stack: [hexRange(10, 22)], gasUsed: 3 } },
  { code: [OP.PUSH14, ...range(10, 23)], pc: '0', result: { stack: [hexRange(10, 23)], gasUsed: 3 } },
  { code: [OP.PUSH15, ...range(10, 24)], pc: '0', result: { stack: [hexRange(10, 24)], gasUsed: 3 } },
  { code: [OP.PUSH16, ...range(10, 25)], pc: '0', result: { stack: [hexRange(10, 25)], gasUsed: 3 } },
  { code: [OP.PUSH17, ...range(10, 26)], pc: '0', result: { stack: [hexRange(10, 26)], gasUsed: 3 } },
  { code: [OP.PUSH18, ...range(10, 27)], pc: '0', result: { stack: [hexRange(10, 27)], gasUsed: 3 } },
  { code: [OP.PUSH19, ...range(10, 28)], pc: '0', result: { stack: [hexRange(10, 28)], gasUsed: 3 } },
  { code: [OP.PUSH20, ...range(10, 29)], pc: '0', result: { stack: [hexRange(10, 29)], gasUsed: 3 } },
  { code: [OP.PUSH21, ...range(10, 30)], pc: '0', result: { stack: [hexRange(10, 30)], gasUsed: 3 } },
  { code: [OP.PUSH22, ...range(10, 31)], pc: '0', result: { stack: [hexRange(10, 31)], gasUsed: 3 } },
  { code: [OP.PUSH23, ...range(10, 32)], pc: '0', result: { stack: [hexRange(10, 32)], gasUsed: 3 } },
  { code: [OP.PUSH24, ...range(10, 33)], pc: '0', result: { stack: [hexRange(10, 33)], gasUsed: 3 } },
  { code: [OP.PUSH25, ...range(10, 34)], pc: '0', result: { stack: [hexRange(10, 34)], gasUsed: 3 } },
  { code: [OP.PUSH26, ...range(10, 35)], pc: '0', result: { stack: [hexRange(10, 35)], gasUsed: 3 } },
  { code: [OP.PUSH27, ...range(10, 36)], pc: '0', result: { stack: [hexRange(10, 36)], gasUsed: 3 } },
  { code: [OP.PUSH28, ...range(10, 37)], pc: '0', result: { stack: [hexRange(10, 37)], gasUsed: 3 } },
  { code: [OP.PUSH29, ...range(10, 38)], pc: '0', result: { stack: [hexRange(10, 38)], gasUsed: 3 } },
  { code: [OP.PUSH30, ...range(10, 39)], pc: '0', result: { stack: [hexRange(10, 39)], gasUsed: 3 } },
  { code: [OP.PUSH31, ...range(10, 40)], pc: '0', result: { stack: [hexRange(10, 40)], gasUsed: 3 } },
  { code: [OP.PUSH32, ...range(10, 41)], pc: '0', result: { stack: [hexRange(10, 41)], gasUsed: 3 } },

  // Data and stack opcodes
  
  { code: OP.CALLDATALOAD,
    stack: [1],
    data: '0x123456',
    result: {
      stack: [parseInt('0x3456000000000000000000000000000000000000000000000000000000000000', 16)],
      gasUsed: 3
    },
  },
  { code: OP.CALLDATASIZE, data: '0x1234', result: { stack: [2], gasUsed: 2 } },

  // Memory and stack (MLOAD, MSTORE, MSTORE8, MSIZE)
  { code: OP.MLOAD,
    stack: [0x01],
    memory: '0x00000000000000000000000000000000000000000000000000000000000000667700000000000000000000000000000000000000000000000000000000000000',
    result: {
      stack: [parseInt('0x0000000000000000000000000000000000000000000000000000000000006677', 16)],
      gasUsed: 3
    },
  },
  { code: OP.MSTORE,
    stack: [parseInt('0x5567', 16), 1],
    result: {
      memory: '0x00000000000000000000000000000000000000000000000000000000000000556700000000000000000000000000000000000000000000000000000000000000',
      gasUsed: 3
    },
  },
  { code: OP.MSTORE8,
    stack: [parseInt('0x5567', 16), 1],
    result: {
      memory: '0x0067000000000000000000000000000000000000000000000000000000000000',
      gasUsed: 3
    },
  },
  { code: OP.MSIZE,
    memory: '0x00000000000000000000000000000000000000000000000000000000000000667700000000000000000000000000000000000000000000000000000000000000',
    result: { stack: [64], gasUsed: 2 }
  },

  // Data, stack and memory type OP-codes (CALLDATACOPY)
  { code: OP.CALLDATACOPY,
    stack: [4, 3, 1],
    data: '0x06397872cdd21945455a7fdc7921e2db7bd8e402607cad66279e899f6ae9b1da',
    result: {
      memory: '0x0072cdd219000000000000000000000000000000000000000000000000000000',
      gasUsed: 3,
    },
  },
  
  // Code, stack and memory type OP-codes (CODECOPY)
  { code: [OP.GASPRICE, OP.POP, OP.CODECOPY],
    stack: [2, 1, 1],
    result: {
      memory: '0x0050390000000000000000000000000000000000000000000000000000000000',
      gasUsed: 3,
    },
  },

  // Storage and stack (SSTORE, SLOAD)
  {
    code: OP.SSTORE,
    stack: [5, 0],
    result: {
      stack: [],
      accounts: [
        {
          address: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          storage: [{ address: 0, value: 5 }],
        },
      ],
      pc: 1,
      gasUsed: 0,
    }
  },
  {
    code: OP.SLOAD,
    stack: [0],
    accounts: [
      {
        address: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        storage: [{ address: 0, value: 5 }],
      },
    ],
    result: {
      stack: [5],
      pc: 1,
      gasUsed: 200,
    }
  },

  // Context, stack and memory type OP-codes (LOG)
  {
    code: OP.LOG0,
    stack: [4, 2],
    memory: '0x0102030405060708091011121314151617181920212223242526272829303132',
    result: {
      stack: [],
      logs: [
        {
          account: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          topics: [0, 0, 0, 0],
          data: '0x02030405',
        }
      ],
      gasUsed: 375
    }
  },
  {
    code: OP.LOG1,
    stack: [0x567, 4, 2],
    memory: '0x0102030405060708091011121314151617181920212223242526272829303132',
    result: {
      stack: [],
      logs: [
        {
          account: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          topics: [0x567, 0, 0, 0],
          data: '0x02030405',
        }
      ],
      gasUsed: 375 * 2
    }
  },
  {
    code: OP.LOG2,
    stack: [0x123, 0x567, 4, 2],
    memory: '0x0102030405060708091011121314151617181920212223242526272829303132',
    result: {
      stack: [],
      logs: [
        {
          account: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          topics: [0x567, 0x123, 0, 0],
          data: '0x02030405',
        }
      ],
      gasUsed: 375 * 3
    }
  },
  {
    code: OP.LOG3,
    stack: [0x987, 0x123, 0x567, 4, 2],
    memory: '0x0102030405060708091011121314151617181920212223242526272829303132',
    result: {
      stack: [],
      logs: [
        {
          account: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          topics: [0x567, 0x123, 0x987, 0],
          data: '0x02030405',
        }
      ],
      gasUsed: 375 * 4
    }
  },
  {
    code: OP.LOG4,
    stack: [0x294, 0x987, 0x123, 0x567, 4, 2],
    memory: '0x0102030405060708091011121314151617181920212223242526272829303132',
    result: {
      stack: [],
      logs: [
        {
          account: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
          topics: [0x567, 0x123, 0x987, 0x294],
          data: '0x02030405',
        }
      ],
      gasUsed: 375 * 5
    }
  },

  // Return, Stack and Memory type OP-codes (RETURN, REVERT, RETURNDATACOPY)
  {
    code: OP.RETURN,
    stack: [0, 0],
    result: {
      stack: [],
      pc: 0,
      gasUsed: 0
    }
  },
  {
    code: OP.REVERT,
    stack: [0, 0],
    result: {
      stack: [],
      errno: OP.ERROR_STATE_REVERTED,
      pc: 0,
      gasUsed: 0
    }
  },
  {
    code: OP.RETURNDATACOPY,
    stack: [0, 0, 0],
    result: {
      stack: [],
      pc: 1,
      gasUsed: 3
    }
  },
];
