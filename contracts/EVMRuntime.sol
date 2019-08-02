pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import { EVMConstants } from "./EVMConstants.sol";
import { EVMMemory } from "./EVMMemory.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMUtils } from "./EVMUtils.slb";
import { EVMCode } from "./EVMCode.slb";


contract EVMRuntime is EVMConstants {
    using EVMMemory for EVMMemory.Memory;
    using EVMStack for EVMStack.Stack;
    using EVMCode for EVMCode.Code;

    // what we do not track  (not complete list)
    // call depth: as we do not support stateful things like call to other contracts
    // staticExec: same as above, we only support precompiles, higher implementations still can intercept calls
    struct EVM {
        uint customDataPtr;
        uint gas;
        uint value;
        uint8 errno;
        uint n;
        uint pc;

        bytes data;
        bytes returnData;

        EVMCode.Code code;
        EVMMemory.Memory mem;
        EVMStack.Stack stack;

        uint256 blockNumber;
        uint256 blockHash;
        uint256 blockTime;
        // caller is also origin, as we do not support calling other contracts
        address caller;
        address target;
    }

    // solhint-disable-next-line code-complexity, function-max-lines, security/no-assign-params
    function _run(EVM memory evm, uint pc, uint pcStepCount) internal {
        uint pcNext = 0;
        uint stepRun = 0;

        while (evm.errno == NO_ERROR && pc < evm.code.length && (pcStepCount == 0 || stepRun < pcStepCount)) {
            uint stackIn;
            uint stackOut;
            uint gasFee;
            uint8 opcode = evm.code.getOpcodeAt(pc);
            function(EVM memory) internal opcodeHandler;

            if (opcode == 0) {
                opcodeHandler = handleSTOP;
                stackIn = 0;
                stackOut = 0;
                gasFee = GAS_ZERO;
            } else if (opcode == 1) {
                opcodeHandler = handleADD;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 2) {
                opcodeHandler = handleMUL;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_LOW;
            } else if (opcode == 3) {
                opcodeHandler = handleSUB;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 4) {
                opcodeHandler = handleDIV;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_LOW;
            } else if (opcode == 5) {
                opcodeHandler = handleSDIV;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_LOW;
            } else if (opcode == 6) {
                opcodeHandler = handleMOD;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_LOW;
            } else if (opcode == 7) {
                opcodeHandler = handleSMOD;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_LOW;
            } else if (opcode == 8) {
                opcodeHandler = handleADDMOD;
                stackIn = 3;
                stackOut = 1;
                gasFee = GAS_MID;
            } else if (opcode == 9) {
                opcodeHandler = handleMULMOD;
                stackIn = 3;
                stackOut = 1;
                gasFee = GAS_MID;
            } else if (opcode == 10) {
                opcodeHandler = handleEXP;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 11) {
                opcodeHandler = handleSIGNEXTEND;
                stackIn = 0;
                stackOut = 0;
                gasFee = GAS_LOW;
            } else if (opcode == 16) {
                opcodeHandler = handleLT;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 17) {
                opcodeHandler = handleGT;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 18) {
                opcodeHandler = handleSLT;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 19) {
                opcodeHandler = handleSGT;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 20) {
                opcodeHandler = handleEQ;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 21) {
                opcodeHandler = handleISZERO;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 22) {
                opcodeHandler = handleAND;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 23) {
                opcodeHandler = handleOR;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 24) {
                opcodeHandler = handleXOR;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 25) {
                opcodeHandler = handleNOT;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 26) {
                opcodeHandler = handleBYTE;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 27) {
                opcodeHandler = handleSHL;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 28) {
                opcodeHandler = handleSHR;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 29) {
                opcodeHandler = handleSAR;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 32) {
                opcodeHandler = handleSHA3;
                stackIn = 2;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 48) {
                opcodeHandler = handleADDRESS;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 49) {
                opcodeHandler = handleBALANCE;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_BALANCE;
            } else if (opcode == 50) {
                opcodeHandler = handleORIGIN;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 51) {
                opcodeHandler = handleCALLER;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 52) {
                opcodeHandler = handleCALLVALUE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 53) {
                opcodeHandler = handleCALLDATALOAD;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 54) {
                opcodeHandler = handleCALLDATASIZE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 55) {
                opcodeHandler = handleCALLDATACOPY;
                stackIn = 3;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 56) {
                opcodeHandler = handleCODESIZE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 57) {
                opcodeHandler = handleCODECOPY;
                stackIn = 3;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 58) {
                opcodeHandler = handleGASPRICE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 59) {
                opcodeHandler = handleEXTCODESIZE;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_EXTCODE;
            } else if (opcode == 60) {
                opcodeHandler = handleEXTCODECOPY;
                stackIn = 4;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 61) {
                opcodeHandler = handleRETURNDATASIZE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 62) {
                opcodeHandler = handleRETURNDATACOPY;
                stackIn = 3;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 63) {
                opcodeHandler = handleEXTCODEHASH;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_EXTCODEHASH;
            } else if (opcode == 64) {
                opcodeHandler = handleBLOCKHASH;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_BLOCKHASH;
            } else if (opcode == 65) {
                opcodeHandler = handleCOINBASE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 66) {
                opcodeHandler = handleTIMESTAMP;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 67) {
                opcodeHandler = handleNUMBER;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 68) {
                opcodeHandler = handleDIFFICULTY;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 69) {
                opcodeHandler = handleGASLIMIT;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 80) {
                opcodeHandler = handlePOP;
                stackIn = 1;
                stackOut = 0;
                gasFee = GAS_BASE;
            } else if (opcode == 81) {
                opcodeHandler = handleMLOAD;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 82) {
                opcodeHandler = handleMSTORE;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 83) {
                opcodeHandler = handleMSTORE8;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 84) {
                opcodeHandler = handleSLOAD;
                stackIn = 1;
                stackOut = 1;
                gasFee = GAS_SLOAD;
            } else if (opcode == 85) {
                opcodeHandler = handleSSTORE;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 86) {
                opcodeHandler = handleJUMP;
                stackIn = 1;
                stackOut = 0;
                gasFee = GAS_MID;
            } else if (opcode == 87) {
                opcodeHandler = handleJUMPI;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_HIGH;
            } else if (opcode == 88) {
                opcodeHandler = handlePC;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 89) {
                opcodeHandler = handleMSIZE;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 90) {
                opcodeHandler = handleGAS;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_BASE;
            } else if (opcode == 91) {
                opcodeHandler = handleJUMPDEST;
                stackIn = 0;
                stackOut = 0;
                gasFee = GAS_JUMPDEST;
            } else if (opcode >= 96 && opcode <= 127) {
                opcodeHandler = handlePUSH;
                stackIn = 0;
                stackOut = 1;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 128) {
                opcodeHandler = handleDUP;
                stackIn = 1;
                stackOut = 2;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 129) {
                opcodeHandler = handleDUP;
                stackIn = 2;
                stackOut = 3;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 130) {
                opcodeHandler = handleDUP;
                stackIn = 3;
                stackOut = 4;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 131) {
                opcodeHandler = handleDUP;
                stackIn = 4;
                stackOut = 5;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 132) {
                opcodeHandler = handleDUP;
                stackIn = 5;
                stackOut = 6;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 133) {
                opcodeHandler = handleDUP;
                stackIn = 6;
                stackOut = 7;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 134) {
                opcodeHandler = handleDUP;
                stackIn = 7;
                stackOut = 8;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 135) {
                opcodeHandler = handleDUP;
                stackIn = 8;
                stackOut = 9;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 136) {
                opcodeHandler = handleDUP;
                stackIn = 9;
                stackOut = 10;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 137) {
                opcodeHandler = handleDUP;
                stackIn = 10;
                stackOut = 11;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 138) {
                opcodeHandler = handleDUP;
                stackIn = 11;
                stackOut = 12;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 139) {
                opcodeHandler = handleDUP;
                stackIn = 12;
                stackOut = 13;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 140) {
                opcodeHandler = handleDUP;
                stackIn = 13;
                stackOut = 14;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 141) {
                opcodeHandler = handleDUP;
                stackIn = 14;
                stackOut = 15;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 142) {
                opcodeHandler = handleDUP;
                stackIn = 15;
                stackOut = 16;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 143) {
                opcodeHandler = handleDUP;
                stackIn = 16;
                stackOut = 17;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 144) {
                opcodeHandler = handleSWAP;
                stackIn = 2;
                stackOut = 2;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 145) {
                opcodeHandler = handleSWAP;
                stackIn = 3;
                stackOut = 3;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 146) {
                opcodeHandler = handleSWAP;
                stackIn = 4;
                stackOut = 4;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 147) {
                opcodeHandler = handleSWAP;
                stackIn = 5;
                stackOut = 5;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 148) {
                opcodeHandler = handleSWAP;
                stackIn = 6;
                stackOut = 6;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 149) {
                opcodeHandler = handleSWAP;
                stackIn = 7;
                stackOut = 7;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 150) {
                opcodeHandler = handleSWAP;
                stackIn = 8;
                stackOut = 8;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 151) {
                opcodeHandler = handleSWAP;
                stackIn = 9;
                stackOut = 9;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 152) {
                opcodeHandler = handleSWAP;
                stackIn = 10;
                stackOut = 10;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 153) {
                opcodeHandler = handleSWAP;
                stackIn = 11;
                stackOut = 11;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 154) {
                opcodeHandler = handleSWAP;
                stackIn = 12;
                stackOut = 12;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 155) {
                opcodeHandler = handleSWAP;
                stackIn = 13;
                stackOut = 13;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 156) {
                opcodeHandler = handleSWAP;
                stackIn = 14;
                stackOut = 14;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 157) {
                opcodeHandler = handleSWAP;
                stackIn = 15;
                stackOut = 15;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 158) {
                opcodeHandler = handleSWAP;
                stackIn = 16;
                stackOut = 16;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 159) {
                opcodeHandler = handleSWAP;
                stackIn = 17;
                stackOut = 17;
                gasFee = GAS_VERYLOW;
            } else if (opcode == 160) {
                opcodeHandler = handleLOG;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 161) {
                opcodeHandler = handleLOG;
                stackIn = 3;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 162) {
                opcodeHandler = handleLOG;
                stackIn = 4;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 163) {
                opcodeHandler = handleLOG;
                stackIn = 5;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 164) {
                opcodeHandler = handleLOG;
                stackIn = 6;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 240) {
                opcodeHandler = handleCREATE;
                stackIn = 3;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 241) {
                opcodeHandler = handleCALL;
                stackIn = 7;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 242) {
                opcodeHandler = handleCALLCODE;
                stackIn = 7;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 243) {
                opcodeHandler = handleRETURN;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 244) {
                opcodeHandler = handleDELEGATECALL;
                stackIn = 6;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 250) {
                opcodeHandler = handleSTATICCALL;
                stackIn = 6;
                stackOut = 1;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 253) {
                opcodeHandler = handleREVERT;
                stackIn = 2;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else if (opcode == 255) {
                opcodeHandler = handleSELFDESTRUCT;
                stackIn = 1;
                stackOut = 0;
                gasFee = GAS_ADDITIONAL_HANDLING;
            } else {
                opcodeHandler = handleINVALID;
                stackIn = 0;
                stackOut = 0;
                gasFee = 0;
            }

            if (gasFee != GAS_ADDITIONAL_HANDLING) {
                if (gasFee > evm.gas) {
                    evm.errno = ERROR_OUT_OF_GAS;
                    evm.gas = 0;
                    break;
                }
                evm.gas -= gasFee;
            }

            // Check for stack errors
            if (evm.stack.size < stackIn) {
                evm.errno = ERROR_STACK_UNDERFLOW;
                break;
            } else if (stackOut > stackIn && evm.stack.size + stackOut - stackIn > MAX_STACK_SIZE) {
                evm.errno = ERROR_STACK_OVERFLOW;
                break;
            }

            if (OP_PUSH1 <= opcode && opcode <= OP_PUSH32) {
                evm.pc = pc;
                uint n = opcode - OP_PUSH1 + 1;
                evm.n = n;
                opcodeHandler(evm);
                pcNext = pc + n + 1;
            } else if (opcode == OP_JUMP || opcode == OP_JUMPI) {
                evm.pc = pc;
                opcodeHandler(evm);
                pcNext = evm.pc;
            } else if (opcode == OP_STOP || opcode == OP_RETURN || opcode == OP_REVERT || opcode == OP_SELFDESTRUCT) {
                opcodeHandler(evm);
                break;
            } else {
                if (OP_DUP1 <= opcode && opcode <= OP_DUP16) {
                    evm.n = opcode - OP_DUP1 + 1;
                    opcodeHandler(evm);
                } else if (OP_SWAP1 <= opcode && opcode <= OP_SWAP16) {
                    evm.n = opcode - OP_SWAP1 + 1;
                    opcodeHandler(evm);
                } else if (OP_LOG0 <= opcode && opcode <= OP_LOG4) {
                    evm.n = opcode - OP_LOG0;
                    opcodeHandler(evm);
                } else if (opcode == OP_PC) {
                    evm.pc = pc;
                    opcodeHandler(evm);
                } else {
                    opcodeHandler(evm);
                }
                pcNext = pc + 1;
            }
            if (evm.errno == NO_ERROR) {
                pc = pcNext;
            }
            stepRun = stepRun + 1;
        }
        evm.pc = pc;
    }

    function computeGasForMemory(EVM memory state, uint mAddr) internal pure returns (uint) {
        uint words = (mAddr + 31) / 32;

        if (words > state.mem.size) {
            // only charge the difference
            uint a = (state.mem.size * GAS_MEMORY) + ((state.mem.size * state.mem.size) / 512);
            uint b = (words * GAS_MEMORY) + ((words * words) / 512);

            return b - a;
        }

        return 0;
    }

    function computeGasForMemory(EVM memory state, uint a, uint b) internal pure returns (uint) {
        if (a > b) {
            return computeGasForMemory(state, a);
        }

        return computeGasForMemory(state, b);
    }

    function computeGasForMemoryCopy(EVM memory state, uint mAddr, uint len) internal pure returns (uint) {
        return computeGasForMemory(state, mAddr + len) + (((len + 31) / 32) * GAS_MEMORY);
    }

    // ************************* Handlers ***************************
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECRECOVER(EVM memory state) internal {
        if (GAS_ECRECOVER > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= GAS_ECRECOVER;

        uint hash = state.data.length < 32 ? 0 : EVMUtils.toUint(state.data, 0, 32);
        uint v = state.data.length < 64 ? 0 : uint8(EVMUtils.toUint(state.data, 32, 32));
        uint r = state.data.length < 96 ? 0 : EVMUtils.toUint(state.data, 64, 32);
        uint s = state.data.length < 128 ? 0 : EVMUtils.toUint(state.data, 96, 32);
        address result = ecrecover(bytes32(hash), uint8(v), bytes32(r), bytes32(s));
        state.returnData = EVMUtils.fromUint(uint(result));
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_SHA256(EVM memory state) internal {
        uint gasFee = GAS_SHA256_BASE + (((state.data.length + 31) / 32) * GAS_SHA256_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        bytes32 result = sha256(state.data);
        state.returnData = EVMUtils.fromUint(uint(result));
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_RIPEMD160(EVM memory state) internal {
        uint gasFee = GAS_RIPEMD160_BASE + (((state.data.length + 31) / 32) * GAS_RIPEMD160_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        bytes20 result = ripemd160(state.data);
        state.returnData = EVMUtils.fromUint(uint(bytes32(result)));
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_IDENTITY(EVM memory state) internal {
        uint gasFee = GAS_IDENTITY_BASE + (((state.data.length + 31) / 32) * GAS_IDENTITY_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.data;
    }

    // solhint-disable-next-line func-name-mixedcase, function-max-lines
    function handlePreC_MODEXP(EVM memory state) internal {
        // EIP-198
        bytes memory inData = state.data;
        bytes memory outData;
        uint256 gasFee = 0;

        assembly {
            let inSize := mload(inData)
            // outSize is length of modulus
            let outSize := mload(add(inData, 0x60))

            // get free mem ptr
            outData := mload(0x40)
            // padding up to word size
            let memEnd := add(
                outData,
                and(
                    add(
                        add(
                            add(outData, outSize),
                            0x20
                        ),
                        0x1F
                    ),
                    not(0x1F)
                )
            )
            // update free mem ptr
            mstore(0x40, memEnd)
            // for correct gas calculation, we have to touch the new highest mem slot
            mstore8(memEnd, 0)
            // store outData.length
            mstore(outData, outSize)

            let inOff := add(inData, 0x20)
            let outOff := add(outData, 0x20)
            let curGas := gas()
            let success := staticcall(curGas, 0x05, inOff, inSize, outOff, outSize)

            if iszero(success) {
                // In this case we run out of gas, and have to revert (safety measure)
                revert(0, 0)
            }
            gasFee := sub(curGas, gas())
        }

        // XXX: static warning, if that is not correct anymore then the bytecode changed.
        // adjust accordingly ;)
        gasFee = (gasFee - 743);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;
        state.returnData = outData;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECADD(EVM memory state) internal {
        // EIP-196
        bytes memory inData = state.data;
        bytes memory outData;
        uint256 success;
        uint256 gas = state.gas;

        assembly {
            let inSize := mload(inData)
            // outSize is 64 bytes
            let outSize := 0x40

            // get free mem ptr
            outData := mload(0x40)
            // padding up to word size
            let memEnd := add(
                outData,
                and(
                    add(
                        add(
                            add(outData, outSize),
                            0x20
                        ),
                        0x1F
                    ),
                    not(0x1F)
                )
            )
            // update free mem ptr
            mstore(0x40, memEnd)
            // store outData.length
            mstore(outData, outSize)

            let inOff := add(inData, 0x20)
            let outOff := add(outData, 0x20)
            success := staticcall(gas, 0x06, inOff, inSize, outOff, outSize)
        }

        if (GAS_EC_ADD > gas || success == 0) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= GAS_EC_ADD;
        state.returnData = outData;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECMUL(EVM memory state) internal {
        // EIP-196
        bytes memory inData = state.data;
        bytes memory outData;
        uint256 success;
        uint256 gas = state.gas;

        assembly {
            let inSize := mload(inData)
            // outSize is 64 bytes
            let outSize := 0x40

            // get free mem ptr
            outData := mload(0x40)
            // padding up to word size
            let memEnd := add(
                outData,
                and(
                    add(
                        add(
                            add(outData, outSize),
                            0x20
                        ),
                        0x1F
                    ),
                    not(0x1F)
                )
            )
            // update free mem ptr
            mstore(0x40, memEnd)
            // store outData.length
            mstore(outData, outSize)

            let inOff := add(inData, 0x20)
            let outOff := add(outData, 0x20)
            success := staticcall(gas, 0x07, inOff, inSize, outOff, outSize)
        }

        if (GAS_EC_MUL > gas || success == 0) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= GAS_EC_MUL;
        state.returnData = outData;
    }

    // solhint-disable-next-line func-name-mixedcase, function-max-lines
    function handlePreC_ECPAIRING(EVM memory state) internal {
        // EIP-197
        bytes memory inData = state.data;
        bytes memory outData;
        uint256 success;
        uint256 gasFee = 0;

        assembly {
            let inSize := mload(inData)
            // outSize is 32 bytes
            let outSize := 0x20

            // get free mem ptr
            outData := mload(0x40)
            // padding up to word size
            let memEnd := add(
                outData,
                and(
                    add(
                        add(
                            add(outData, outSize),
                            0x20
                        ),
                        0x1F
                    ),
                    not(0x1F)
                )
            )
            // update free mem ptr
            mstore(0x40, memEnd)
            // for correct gas calculation, we have to touch the new highest mem slot
            mstore8(memEnd, 0)
            // store outData.length
            mstore(outData, outSize)

            let inOff := add(inData, 0x20)
            let outOff := add(outData, 0x20)
            let curGas := gas()

            success := staticcall(curGas, 0x08, inOff, inSize, outOff, outSize)
            gasFee := sub(curGas, gas())
        }

        // XXX: static warning, if that is not correct anymore then the bytecode changed.
        // adjust accordingly ;)
        gasFee = (gasFee - 725);

        if (gasFee > state.gas || success == 0) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;
        state.returnData = outData;
    }
    // 0x0X

    // solhint-disable-next-line no-empty-blocks
    function handleSTOP(EVM memory state) internal {

    }

    function handleADD(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := add(a, b)
        }
        state.stack.push(c);
    }

    function handleMUL(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mul(a, b)
        }
        state.stack.push(c);
    }

    function handleSUB(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sub(a, b)
        }
        state.stack.push(c);
    }

    function handleDIV(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := div(a, b)
        }
        state.stack.push(c);
    }

    function handleSDIV(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sdiv(a, b)
        }
        state.stack.push(c);
    }

    function handleMOD(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mod(a, b)
        }
        state.stack.push(c);
    }

    function handleSMOD(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := smod(a, b)
        }
        state.stack.push(c);
    }

    function handleADDMOD(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := addmod(a, b, m)
        }
        state.stack.push(c);
    }

    function handleMULMOD(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := mulmod(a, b, m)
        }
        state.stack.push(c);
    }

    function handleEXP(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c = 0;

        for (uint i = 0; i <= 256; i += 8) {
            if (b | c == c) {
                c = i / 8;
                break;
            }
            c = c | (0xff << i);
        }

        c = GAS_EXP + (c * GAS_EXPBYTE);

        if (c > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= c;

        assembly {
            c := exp(a, b)
        }
        state.stack.push(c);
    }

    function handleSIGNEXTEND(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := signextend(a, b)
        }
        state.stack.push(c);
    }

    function handleSHL(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shl(a, b)
        }
        state.stack.push(c);
    }

    function handleSHR(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shr(a, b)
        }
        state.stack.push(c);
    }

    function handleSAR(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sar(a, b)
        }
        state.stack.push(c);
    }

    // 0x1X
    function handleLT(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := lt(a, b)
        }
        state.stack.push(c);
    }

    function handleGT(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := gt(a, b)
        }
        state.stack.push(c);
    }

    function handleSLT(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := slt(a, b)
        }
        state.stack.push(c);
    }

    function handleSGT(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sgt(a, b)
        }
        state.stack.push(c);
    }

    function handleEQ(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := eq(a, b)
        }
        state.stack.push(c);
    }

    function handleISZERO(EVM memory state) internal {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := iszero(data)
        }
        state.stack.push(res);
    }

    function handleAND(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := and(a, b)
        }
        state.stack.push(c);
    }

    function handleOR(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := or(a, b)
        }
        state.stack.push(c);
    }

    function handleXOR(EVM memory state) internal {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := xor(a, b)
        }
        state.stack.push(c);
    }

    function handleNOT(EVM memory state) internal {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := not(data)
        }
        state.stack.push(res);
    }

    function handleBYTE(EVM memory state) internal {
        uint n = state.stack.pop();
        uint x = state.stack.pop();
        uint b;
        assembly {
            b := byte(n, x)
        }
        state.stack.push(b);
    }

    // 0x2X
    function handleSHA3(EVM memory state) internal {
        uint p = state.stack.pop();
        uint n = state.stack.pop();
        uint res = GAS_SHA3 +
            (((n + 31) / 32) * GAS_SHA3WORD) +
            computeGasForMemory(state, p + n);

        if (res > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= res;

        uint mp = state.mem.memUPtr(p, n);

        assembly {
            res := keccak256(mp, n)
        }
        state.stack.push(res);
    }

    // 0x3X
    function handleADDRESS(EVM memory state) internal {
        state.stack.push(uint(state.target));
    }

    // not supported, we are stateless
    function handleBALANCE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleORIGIN(EVM memory state) internal {
        state.stack.push(uint(state.caller));
    }

    function handleCALLER(EVM memory state) internal {
        state.stack.push(uint(state.caller));
    }

    function handleCALLVALUE(EVM memory state) internal {
        state.stack.push(state.value);
    }

    function handleCALLDATALOAD(EVM memory state) internal {
        uint addr = state.stack.pop();
        bytes memory data = state.data;
        uint val;
        // When some or all of the 32 bytes fall outside of the calldata array,
        // we have to replace those bytes with zeroes.
        if (addr >= data.length) {
            val = 0;
        } else {
            assembly {
                val := mload(add(data, add(0x20, addr)))
            }
            if (addr + WORD_SIZE > data.length) {
                val &= ~uint(0) << 8 * (32 - data.length + addr);
            }
        }
        state.stack.push(val);
    }

    function handleCALLDATASIZE(EVM memory state) internal {
        state.stack.push(state.data.length);
    }

    function handleCALLDATACOPY(EVM memory state) internal {
        uint mAddr = state.stack.pop();
        uint dAddr = state.stack.pop();
        uint len = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.storeBytesAndPadWithZeroes(
            state.data,
            dAddr,
            mAddr,
            len
        );
    }

    function handleCODESIZE(EVM memory state) internal {
        state.stack.push(state.code.length);
    }

    function handleCODECOPY(EVM memory state) internal {
        uint mAddr = state.stack.pop();
        uint cAddr = state.stack.pop();
        uint len = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.storeBytes(state.code.toBytes(cAddr, len), 0, mAddr, len);
    }

    function handleGASPRICE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // this can be implemented for special needs, the EVMRuntime itself should be stateless
    function handleEXTCODESIZE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // same as above
    function handleEXTCODECOPY(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleRETURNDATASIZE(EVM memory state) internal {
        state.stack.push(state.returnData.length);
    }

    function handleRETURNDATACOPY(EVM memory state) internal {
        uint mAddr = state.stack.pop();
        uint rAddr = state.stack.pop();
        uint len = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.storeBytesAndPadWithZeroes(
            state.returnData,
            rAddr,
            mAddr,
            len
        );
    }

    function handleEXTCODEHASH(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // 0x4X
    function handleBLOCKHASH(EVM memory state) internal {
        state.stack.pop();
        state.stack.push(state.blockHash);
    }

    function handleCOINBASE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleTIMESTAMP(EVM memory state) internal {
        state.stack.push(state.blockTime);
    }

    function handleNUMBER(EVM memory state) internal {
        state.stack.push(state.blockNumber);
    }

    function handleDIFFICULTY(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleGASLIMIT(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // 0x5X
    function handlePOP(EVM memory state) internal {
        state.stack.pop();
    }

    function handleMLOAD(EVM memory state) internal {
        uint addr = state.stack.pop();
        uint gasFee = GAS_VERYLOW + computeGasForMemory(state, addr + 32);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.stack.push(state.mem.load(addr));
    }

    function handleMSTORE(EVM memory state) internal {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemory(state, addr + 32);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.store(addr, val);
    }

    function handleMSTORE8(EVM memory state) internal {
        uint addr = state.stack.pop();
        uint8 val = uint8(state.stack.pop());

        uint gasFee = GAS_VERYLOW + computeGasForMemory(state, addr + 1);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.store8(addr, val);
    }

    function handleSLOAD(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleSSTORE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleJUMP(EVM memory state) internal {
        uint dest = state.stack.pop();
        if (dest >= state.code.length || state.code.getOpcodeAt(dest) != OP_JUMPDEST) {
            state.errno = ERROR_INVALID_JUMP_DESTINATION;
            return;
        }
        state.pc = dest;
    }

    function handleJUMPI(EVM memory state) internal {
        uint dest = state.stack.pop();
        uint cnd = state.stack.pop();
        if (cnd == 0) {
            state.pc = state.pc + 1;
            return;
        }
        if (dest >= state.code.length || state.code.getOpcodeAt(dest) != OP_JUMPDEST) {
            state.errno = ERROR_INVALID_JUMP_DESTINATION;
            return;
        }
        state.pc = dest;
    }

    function handlePC(EVM memory state) internal {
        state.stack.push(state.pc);
    }

    function handleMSIZE(EVM memory state) internal {
        state.stack.push(32 * state.mem.size);
    }

    function handleGAS(EVM memory state) internal {
        state.stack.push(state.gas);
    }

    // solhint-disable-next-line no-empty-blocks
    function handleJUMPDEST(EVM memory state) internal {

    }

    // 0x6X, 0x7X
    function handlePUSH(EVM memory state) internal {
        assert(1 <= state.n && state.n <= 32);

        // we do not throw a ERROR_INDEX_OOB here,
        // instead we right-pad with zero
        state.stack.push(state.code.toUint(state.pc + 1, state.n));
    }

    // 0x8X
    function handleDUP(EVM memory state) internal {
        assert(1 <= state.n && state.n <= 16);
        state.stack.dup(state.n);
    }

    // 0x9X
    function handleSWAP(EVM memory state) internal {
        assert(1 <= state.n && state.n <= 16);
        state.stack.swap(state.n);
    }

    // 0xaX
    // Logs are also stateful and thus not supported
    function handleLOG(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // 0xfX
    function handleCREATE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCREATE2(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCALL(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCALLCODE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleRETURN(EVM memory state) internal {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toBytes(start, len);
    }

    function handleDELEGATECALL(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function handleSTATICCALL(EVM memory state) internal {
        // TODO: as we are only support precompiles, remove the retEvm to save memory and instructions
        EVM memory retEvm;

        retEvm.gas = state.stack.pop();
        uint target = uint(address(state.stack.pop()));

        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();

        uint gasFee = GAS_CALL +
            computeGasForMemory(state, retOffset + retSize, inOffset + inSize);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        if (retEvm.gas > state.gas) {
            retEvm.gas = state.gas;
        }
        state.gas -= retEvm.gas;

        retEvm.data = state.mem.toBytes(inOffset, inSize);
        retEvm.customDataPtr = state.customDataPtr;

        // we only going to support precompiles
        if (1 <= target && target <= 8) {
            if (target == 1) {
                handlePreC_ECRECOVER(retEvm);
            } else if (target == 2) {
                handlePreC_SHA256(retEvm);
            } else if (target == 3) {
                handlePreC_RIPEMD160(retEvm);
            } else if (target == 4) {
                handlePreC_IDENTITY(retEvm);
            } else if (target == 5) {
                handlePreC_MODEXP(retEvm);
            } else if (target == 6) {
                handlePreC_ECADD(retEvm);
            } else if (target == 7) {
                handlePreC_ECMUL(retEvm);
            } else if (target == 8) {
                handlePreC_ECPAIRING(retEvm);
            }
        } else {
            retEvm.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
        }

        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
            state.returnData = new bytes(0);
        } else {
            state.stack.push(1);
            state.mem.storeBytesAndPadWithZeroes(retEvm.returnData, 0, retOffset, retSize);
            state.returnData = retEvm.returnData;
        }
        state.gas += retEvm.gas;
    }

    function handleREVERT(EVM memory state) internal {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toBytes(start, len);
        state.errno = ERROR_STATE_REVERTED;
    }

    function handleINVALID(EVM memory evm) internal {
        evm.errno = ERROR_INVALID_OPCODE;
    }

    function handleSELFDESTRUCT(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
}
