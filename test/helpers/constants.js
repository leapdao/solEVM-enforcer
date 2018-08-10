export const DEFAULT_CALLER = 'cd1722f2947def4cf144679da39c4c32bdc35681';
export const DEFAULT_CONTRACT_ADDRESS = '0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6';
// Errors

export const NO_ERROR = 0;
export const ERROR_STACK_OVERFLOW = 0x01;
export const ERROR_STACK_UNDERFLOW = 0x02;
export const ERROR_INDEX_OOB = 0x03;
export const ERROR_INVALID_OPCODE = 0x04;
export const ERROR_INVALID_JUMP_DESTINATION = 0x05;
export const ERROR_INSTRUCTION_NOT_SUPPORTED = 0x06;
export const ERROR_STATE_REVERTED = 0x07;
export const ERROR_INSUFFICIENT_FUNDS = 0x08;
export const ERROR_CONTRACT_CREATION_COLLISION = 0x09;
export const ERROR_MAX_CODE_SIZE_EXCEEDED = 0x0a;
export const ERROR_ILLEGAL_WRITE_OPERATION = 0x0b;
export const ERROR_PRECOMPILE_NOT_IMPLEMENTED = 0x0c;

// Ethereum opcodes

// Stop and arithmetic ops
export const STOP = '00';
export const ADD = '01';
export const MUL = '02';
export const SUB = '03';
export const DIV = '04';
export const SDIV = '05';
export const MOD = '06';
export const SMOD = '07';
export const ADDMOD = '08';
export const MULMOD = '09';
export const EXP = '0a';
export const SIGNEXTEND = '0b';

// Comparison & bitwise logic
export const LT = '10';
export const GT = '11';
export const SLT = '12';
export const SGT = '13';
export const EQ = '14';
export const ISZERO = '15';
export const AND = '16';
export const OR = '17';
export const XOR = '18';
export const NOT = '19';
export const BYTE = '1a';
export const SHL = '1b';
export const SHR = '1c';
export const SAR = '1d';
// SHA3
export const SHA3 = '20';

// Environmental information
export const ADDRESS = '30';
export const BALANCE = '31';
export const ORIGIN = '32';
export const CALLER = '33';
export const CALLVALUE = '34';
export const CALLDATALOAD = '35';
export const CALLDATASIZE = '36';
export const CALLDATACOPY = '37';
export const CODESIZE = '38';
export const CODECOPY = '39';
export const GASPRICE = '3a';
export const EXTCODESIZE = '3b';
export const EXTCODECOPY = '3c';
export const RETURNDATASIZE = '3d';
export const RETURNDATACOPY = '3e';

// Block information
export const BLOCKHASH = '40';
export const COINBASE = '41';
export const TIMESTAMP = '42';
export const NUMBER = '43';
export const DIFFICULTY = '44';
export const GASLIMIT = '45';

// Stack, Memory, Storage and Flow Operations
export const POP = '50';
export const MLOAD = '51';
export const MSTORE = '52';
export const MSTORE8 = '53';
export const SLOAD = '54';
export const SSTORE = '55';
export const JUMP = '56';
export const JUMPI = '57';
export const PC = '58';
export const MSIZE = '59';
export const GAS = '5a';
export const JUMPDEST = '5b';

// Push operations
export const PUSH1 = '60';
export const PUSH2 = '61';
export const PUSH3 = '62';
export const PUSH4 = '63';
export const PUSH5 = '64';
export const PUSH6 = '65';
export const PUSH7 = '66';
export const PUSH8 = '67';
export const PUSH9 = '68';
export const PUSH10 = '69';
export const PUSH11 = '6a';
export const PUSH12 = '6b';
export const PUSH13 = '6c';
export const PUSH14 = '6d';
export const PUSH15 = '6e';
export const PUSH16 = '6f';
export const PUSH17 = '70';
export const PUSH18 = '71';
export const PUSH19 = '72';
export const PUSH20 = '73';
export const PUSH21 = '74';
export const PUSH22 = '75';
export const PUSH23 = '76';
export const PUSH24 = '77';
export const PUSH25 = '78';
export const PUSH26 = '79';
export const PUSH27 = '7a';
export const PUSH28 = '7b';
export const PUSH29 = '7c';
export const PUSH30 = '7d';
export const PUSH31 = '7e';
export const PUSH32 = '7f';

// Duplication operations
export const DUP1 = '80';
export const DUP2 = '81';
export const DUP3 = '82';
export const DUP4 = '83';
export const DUP5 = '84';
export const DUP6 = '85';
export const DUP7 = '86';
export const DUP8 = '87';
export const DUP9 = '88';
export const DUP10 = '89';
export const DUP11 = '8a';
export const DUP12 = '8b';
export const DUP13 = '8c';
export const DUP14 = '8d';
export const DUP15 = '8e';
export const DUP16 = '8f';

// Exchange operations
export const SWAP1 = '90';
export const SWAP2 = '91';
export const SWAP3 = '92';
export const SWAP4 = '93';
export const SWAP5 = '94';
export const SWAP6 = '95';
export const SWAP7 = '96';
export const SWAP8 = '97';
export const SWAP9 = '98';
export const SWAP10 = '99';
export const SWAP11 = '9a';
export const SWAP12 = '9b';
export const SWAP13 = '9c';
export const SWAP14 = '9d';
export const SWAP15 = '9e';
export const SWAP16 = '9f';

// Logging operations
export const LOG0 = 'a0';
export const LOG1 = 'a1';
export const LOG2 = 'a2';
export const LOG3 = 'a3';
export const LOG4 = 'a4';

// System operations
export const CREATE = 'f0';
export const CALL = 'f1';
export const CALLCODE = 'f2';
export const RETURN = 'f3';
export const DELEGATECALL = 'f4';
export const STATICCALL = 'fa';
export const REVERT = 'fd';
export const INVALID = 'fe';
export const SELFDESTRUCT = 'ff';

export const BLOCK_GAS_LIMIT = '0xfffffffffffff';