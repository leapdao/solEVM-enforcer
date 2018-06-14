pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;
pragma solidity ^0.4.22;

contract EVMConstants {

    // Stop and arithmetic ops
    uint constant internal OP_STOP = 0x00;
    uint constant internal OP_ADD = 0x01;
    uint constant internal OP_MUL = 0x02;
    uint constant internal OP_SUB = 0x03;
    uint constant internal OP_DIV = 0x04;
    uint constant internal OP_SDIV = 0x05;
    uint constant internal OP_MOD = 0x06;
    uint constant internal OP_SMOD = 0x07;
    uint constant internal OP_ADDMOD = 0x08;
    uint constant internal OP_MULMOD = 0x09;
    uint constant internal OP_EXP = 0x0a;
    uint constant internal OP_SIGNEXTEND = 0x0b;

    // Comparison & bitwise logic
    uint constant internal OP_LT = 0x10;
    uint constant internal OP_GT = 0x11;
    uint constant internal OP_SLT = 0x12;
    uint constant internal OP_SGT = 0x13;
    uint constant internal OP_EQ = 0x14;
    uint constant internal OP_ISZERO = 0x15;
    uint constant internal OP_AND = 0x16;
    uint constant internal OP_OR = 0x17;
    uint constant internal OP_XOR = 0x18;
    uint constant internal OP_NOT = 0x19;
    uint constant internal OP_BYTE = 0x1a;
    uint constant internal OP_SHL = 0x1b;
    uint constant internal OP_SHR = 0x1c;
    uint constant internal OP_SAR = 0x1d;

    // SHA3
    uint constant internal OP_SHA3 = 0x20;

    // Environmental information
    uint constant internal OP_ADDRESS = 0x30;
    uint constant internal OP_BALANCE = 0x31;
    uint constant internal OP_ORIGIN = 0x32;
    uint constant internal OP_CALLER = 0x33;
    uint constant internal OP_CALLVALUE = 0x34;
    uint constant internal OP_CALLDATALOAD = 0x35;
    uint constant internal OP_CALLDATASIZE = 0x36;
    uint constant internal OP_CALLDATACOPY = 0x37;
    uint constant internal OP_CODESIZE = 0x38;
    uint constant internal OP_CODECOPY = 0x39;
    uint constant internal OP_GASPRICE = 0x3a;
    uint constant internal OP_EXTCODESIZE = 0x3b;
    uint constant internal OP_EXTCODECOPY = 0x3c;
    uint constant internal OP_RETURNDATASIZE = 0x3d;
    uint constant internal OP_RETURNDATACOPY = 0x3e;

    // Block information
    uint constant internal OP_BLOCKHASH = 0x40;
    uint constant internal OP_COINBASE = 0x41;
    uint constant internal OP_TIMESTAMP = 0x42;
    uint constant internal OP_NUMBER = 0x43;
    uint constant internal OP_DIFFICULTY = 0x44;
    uint constant internal OP_GASLIMIT = 0x45;

    // Stack, Memory, Storage and Flow Operations
    uint constant internal OP_POP = 0x50;
    uint constant internal OP_MLOAD = 0x51;
    uint constant internal OP_MSTORE = 0x52;
    uint constant internal OP_MSTORE8 = 0x53;
    uint constant internal OP_SLOAD = 0x54;
    uint constant internal OP_SSTORE = 0x55;
    uint constant internal OP_JUMP = 0x56;
    uint constant internal OP_JUMPI = 0x57;
    uint constant internal OP_PC = 0x58;
    uint constant internal OP_MSIZE = 0x59;
    uint constant internal OP_GAS = 0x5a;
    uint constant internal OP_JUMPDEST = 0x5b;

    // Push operations
    uint constant internal OP_PUSH1 = 0x60;
    uint constant internal OP_PUSH2 = 0x61;
    uint constant internal OP_PUSH3 = 0x62;
    uint constant internal OP_PUSH4 = 0x63;
    uint constant internal OP_PUSH5 = 0x64;
    uint constant internal OP_PUSH6 = 0x65;
    uint constant internal OP_PUSH7 = 0x66;
    uint constant internal OP_PUSH8 = 0x67;
    uint constant internal OP_PUSH9 = 0x68;
    uint constant internal OP_PUSH10 = 0x69;
    uint constant internal OP_PUSH11 = 0x6a;
    uint constant internal OP_PUSH12 = 0x6b;
    uint constant internal OP_PUSH13 = 0x6c;
    uint constant internal OP_PUSH14 = 0x6d;
    uint constant internal OP_PUSH15 = 0x6e;
    uint constant internal OP_PUSH16 = 0x6f;
    uint constant internal OP_PUSH17 = 0x70;
    uint constant internal OP_PUSH18 = 0x71;
    uint constant internal OP_PUSH19 = 0x72;
    uint constant internal OP_PUSH20 = 0x73;
    uint constant internal OP_PUSH21 = 0x74;
    uint constant internal OP_PUSH22 = 0x75;
    uint constant internal OP_PUSH23 = 0x76;
    uint constant internal OP_PUSH24 = 0x77;
    uint constant internal OP_PUSH25 = 0x78;
    uint constant internal OP_PUSH26 = 0x79;
    uint constant internal OP_PUSH27 = 0x7a;
    uint constant internal OP_PUSH28 = 0x7b;
    uint constant internal OP_PUSH29 = 0x7c;
    uint constant internal OP_PUSH30 = 0x7d;
    uint constant internal OP_PUSH31 = 0x7e;
    uint constant internal OP_PUSH32 = 0x7f;

    // Duplication operations
    uint constant internal OP_DUP1 = 0x80;
    uint constant internal OP_DUP2 = 0x81;
    uint constant internal OP_DUP3 = 0x82;
    uint constant internal OP_DUP4 = 0x83;
    uint constant internal OP_DUP5 = 0x84;
    uint constant internal OP_DUP6 = 0x85;
    uint constant internal OP_DUP7 = 0x86;
    uint constant internal OP_DUP8 = 0x87;
    uint constant internal OP_DUP9 = 0x88;
    uint constant internal OP_DUP10 = 0x89;
    uint constant internal OP_DUP11 = 0x8a;
    uint constant internal OP_DUP12 = 0x8b;
    uint constant internal OP_DUP13 = 0x8c;
    uint constant internal OP_DUP14 = 0x8d;
    uint constant internal OP_DUP15 = 0x8e;
    uint constant internal OP_DUP16 = 0x8f;

    // Exchange operations
    uint constant internal OP_SWAP1 = 0x90;
    uint constant internal OP_SWAP2 = 0x91;
    uint constant internal OP_SWAP3 = 0x92;
    uint constant internal OP_SWAP4 = 0x93;
    uint constant internal OP_SWAP5 = 0x94;
    uint constant internal OP_SWAP6 = 0x95;
    uint constant internal OP_SWAP7 = 0x96;
    uint constant internal OP_SWAP8 = 0x97;
    uint constant internal OP_SWAP9 = 0x98;
    uint constant internal OP_SWAP10 = 0x99;
    uint constant internal OP_SWAP11 = 0x9a;
    uint constant internal OP_SWAP12 = 0x9b;
    uint constant internal OP_SWAP13 = 0x9c;
    uint constant internal OP_SWAP14 = 0x9d;
    uint constant internal OP_SWAP15 = 0x9e;
    uint constant internal OP_SWAP16 = 0x9f;

    // Logging operations
    uint constant internal OP_LOG0 = 0xa0;
    uint constant internal OP_LOG1 = 0xa1;
    uint constant internal OP_LOG2 = 0xa2;
    uint constant internal OP_LOG3 = 0xa3;
    uint constant internal OP_LOG4 = 0xa4;

    // System operations
    uint constant internal OP_CREATE = 0xf0;
    uint constant internal OP_CALL = 0xf1;
    uint constant internal OP_CALLCODE = 0xf2;
    uint constant internal OP_RETURN = 0xf3;
    uint constant internal OP_DELEGATECALL = 0xf4;
    uint constant internal OP_STATICCALL = 0xfa;
    uint constant internal OP_REVERT = 0xfd;
    uint constant internal OP_INVALID = 0xfe;
    uint constant internal OP_SELFDESTRUCT = 0xff;

    // GAS
    uint constant internal GAS_ZERO = 0;
    uint constant internal GAS_BASE = 2;
    uint constant internal GAS_VERYLOW = 3;
    uint constant internal GAS_LOW = 5;
    uint constant internal GAS_MID = 8;
    uint constant internal GAS_HIGH = 10;

    uint constant internal GAS_EXTCODE = 700;
    uint constant internal GAS_BALANCE = 400;
    uint constant internal GAS_JUMPDEST = 1;
    uint constant internal GAS_SLOAD = 200;
    uint constant internal GAS_SSET = 20000;
    uint constant internal GAS_SRESET = 5000;
    uint constant internal GAS_R_SCLEAR = 15000;
    uint constant internal GAS_R_SELFDESTRUCT = 24000;
    uint constant internal GAS_SELFDESTRUCT = 5000;
    uint constant internal GAS_CREATE = 32000;
    uint constant internal GAS_CODEDEPOSIT = 200;
    uint constant internal GAS_CALL = 700;
    uint constant internal GAS_CALLVALUE = 9000;
    uint constant internal GAS_CALLSTIPEND = 2300;
    uint constant internal GAS_NEWACCOUNT = 25000;
    uint constant internal GAS_EXP = 10;
    uint constant internal GAS_EXPBYTE = 50;
    uint constant internal GAS_MEMORY = 3;
    uint constant internal GAS_TXCREATE = 32000;
    uint constant internal GAS_TXDATAZERO = 4;
    uint constant internal GAS_TXDATANONZERO = 68;
    uint constant internal GAS_TRANSACTION = 21000;
    uint constant internal GAS_LOG = 375;
    uint constant internal GAS_LOGDATA = 8;
    uint constant internal GAS_LOGTOPIC = 375;
    uint constant internal GAS_SHA3 = 30;
    uint constant internal GAS_SHA3WORD = 6;
    uint constant internal GAS_COPY = 3;
    uint constant internal GAS_BLOCKHASH = 20;
    uint constant internal GAS_QUADDIVISOR = 100;

    // Precompiles
    uint constant internal GAS_ECRECOVER = 3000;
    uint constant internal GAS_SHA256_BASE = 60;
    uint constant internal GAS_SHA256_WORD = 12;
    uint constant internal GAS_RIPEMD160_BASE = 600;
    uint constant internal GAS_RIPEMD160_WORD = 120;
    uint constant internal GAS_IDENTITY_BASE = 15;
    uint constant internal GAS_IDENTITY_WORD = 3;

    // ERRORS

    uint constant internal NO_ERROR = 0;
    uint constant internal ERROR_STACK_OVERFLOW = 0x01;
    uint constant internal ERROR_STACK_UNDERFLOW = 0x02;
    uint constant internal ERROR_INDEX_OOB = 0x03;
    uint constant internal ERROR_INVALID_OPCODE = 0x04;
    uint constant internal ERROR_INVALID_JUMP_DESTINATION = 0x05;
    uint constant internal ERROR_INSTRUCTION_NOT_SUPPORTED = 0x06;
    uint constant internal ERROR_STATE_REVERTED = 0x07;
    uint constant internal ERROR_INSUFFICIENT_FUNDS = 0x08;
    uint constant internal ERROR_CONTRACT_CREATION_COLLISION = 0x09;
    uint constant internal ERROR_MAX_CODE_SIZE_EXCEEDED = 0x0a;
    uint constant internal ERROR_ILLEGAL_WRITE_OPERATION = 0x0b;
    uint constant internal ERROR_PRECOMPILE_NOT_IMPLEMENTED = 0x0c;
    uint constant internal ERROR_OUT_OF_GAS = 0x0d;

    // ENV

    uint constant internal MAX_STACK_SIZE = 1024;
    uint constant internal CALL_CREATE_DEPTH = 1024;
    uint constant internal WORD_SIZE = 32;
    uint constant internal MAX_CODE_SIZE = 24576;

}