pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


import { EVMConstants } from "./EVMConstants.sol";
import { EVMAccounts } from "./EVMAccounts.slb";
import { EVMStorage } from "./EVMStorage.slb";
import { EVMMemory } from "./EVMMemory.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMLogs } from "./EVMLogs.slb";
import { EVMUtils } from "./EVMUtils.slb";
import { EVMCode } from "./EVMCode.slb";
import { IEthereumRuntime } from "./IEthereumRuntime.sol";


contract EthereumRuntime is EVMConstants, IEthereumRuntime {

    enum CallType {
        Call,
        StaticCall,
        DelegateCall,
        CallCode
    }

    address constant internal DEFAULT_CONTRACT_ADDRESS = 0x0f572e5295c57F15886F9b263E2f6d2d6c7b5ec6;
    address constant internal DEFAULT_CALLER = 0xcD1722f2947Def4CF144679da39c4C32bDc35681;

    using EVMAccounts for EVMAccounts.Accounts;
    using EVMAccounts for EVMAccounts.Account;
    using EVMStorage for EVMStorage.Storage;
    using EVMMemory for EVMMemory.Memory;
    using EVMStack for EVMStack.Stack;
    using EVMLogs for EVMLogs.Logs;
    using EVMCode for EVMCode.Code;

    // ************* Used as input/output *************
    struct Context {
        address origin;
        uint gasPrice;
        uint gasLimit;
        uint coinBase;
        uint blockNumber;
        uint time;
        uint difficulty;
    }

    struct TxInput {
        uint gas;
        uint gasPrice;
        address caller;
        uint callerBalance;
        uint value;
        address target;
        uint targetBalance;
        bytes targetCode;
        bytes data;
        bool staticExec;
    }

    // ************* Only used internally *************
    struct EVMInput {
        uint gas;
        uint value;
        bytes data;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        bytes32 logHash;
        bool staticExec;

        EVMMemory.Memory mem;
        EVMStack.Stack stack;
        uint pcStart;
        uint pcStepCount;
    }

    struct EVMCreateInput {
        uint gas;
        uint value;
        EVMCode.Code code;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        bytes32 logHash;
    }

    struct EVM {
        uint gas;
        uint value;
        EVMCode.Code code;
        bytes data;
        bytes lastRet;
        bytes returnData;
        uint8 errno;

        EVMAccounts.Accounts accounts;
        bytes32 logHash;
        Context context;
        EVMMemory.Memory mem;
        EVMStack.Stack stack;

        // TODO: max 1024;
        uint16 depth;

        EVMAccounts.Account caller;
        EVMAccounts.Account target;
        uint n;
        uint pc;

        bool staticExec;
    }

    // Init EVM with given stack and memory and execute from the given opcode
    // solhint-disable-next-line function-max-lines
    function execute(EVMPreimage memory img) public view returns (EVMResult memory) {
        // solhint-disable-next-line avoid-low-level-calls
        EVM memory evm;

        evm.context = Context(
            DEFAULT_CALLER,
            0,
            // block gas limit
            img.gasLimit,
            0,
            0,
            0,
            0
        );

        evm.data = img.data;
        evm.gas = img.gasRemaining;
        evm.logHash = img.logHash;

        evm.accounts = EVMAccounts.fromArray(img.accounts, img.accountsCode);
        EVMAccounts.Account memory caller = evm.accounts.get(DEFAULT_CALLER);
        caller.nonce = uint8(1);

        EVMAccounts.Account memory target = evm.accounts.get(DEFAULT_CONTRACT_ADDRESS);
        target.code = EVMCode.fromAddress(img.code);

        evm.caller = evm.accounts.get(DEFAULT_CALLER);
        // TODO touching accounts.
        evm.target = evm.accounts.get(DEFAULT_CONTRACT_ADDRESS);

        evm.code = evm.target.code;
        evm.stack = EVMStack.fromArray(img.stack);
        evm.mem = EVMMemory.fromArray(img.mem);

        _run(evm, img.pc, img.stepCount);

        Context memory context = evm.context;
        bytes32 hashValue = stateHash(evm, context);
        EVMResult memory resultState;
        
        resultState.gas = evm.gas;
        resultState.code = evm.code;
        resultState.data = evm.data;
        resultState.lastRet = evm.lastRet;
        resultState.returnData = evm.returnData;
        resultState.errno = evm.errno;
        (resultState.accounts, resultState.accountsCode) = EVMAccounts.toArray(evm.accounts);
        resultState.logHash = evm.logHash;
        resultState.mem = EVMMemory.toArray(evm.mem);
        resultState.stack = EVMStack.toArray(evm.stack);
        resultState.depth = evm.depth;
        // resultState.n = evm.n;
        resultState.pc = evm.pc;
        resultState.hashValue = hashValue;

        return resultState;
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function _call(EVMInput memory evmInput, CallType callType) internal view returns (EVM memory evm) {
        evm.context = evmInput.context;
        evm.logHash = evmInput.logHash;
        if (evmInput.staticExec) {
            evm.accounts = evmInput.accounts;
        } else {
            evm.accounts = evmInput.accounts.copy();
        }
        evm.value = evmInput.value;
        evm.gas = evmInput.gas;
        evm.data = evmInput.data;
        evm.caller = evm.accounts.get(evmInput.caller);
        // TODO touching accounts.
        evm.target = evm.accounts.get(evmInput.target);
        evm.staticExec = evmInput.staticExec;

        // Transfer value. TODO if callcode is added
        if (callType != CallType.DelegateCall && evm.value > 0) {
            if (evm.staticExec) {
                evm.errno = ERROR_ILLEGAL_WRITE_OPERATION;
                return evm;
            }
            if (evm.caller.balance < evm.value) {
                evm.errno = ERROR_INSUFFICIENT_FUNDS;
                return evm;
            }
            evm.caller.balance -= evm.value;
            evm.target.balance += evm.value;
        }

        if (1 <= uint(evm.target.addr) && uint(evm.target.addr) <= 8) {
            if (uint(evm.target.addr) == 1) {
                handlePreC_ECRECOVER(evm);
            } else if (uint(evm.target.addr) == 2) {
                handlePreC_SHA256(evm);
            } else if (uint(evm.target.addr) == 3) {
                handlePreC_RIPEMD160(evm);
            } else if (uint(evm.target.addr) == 4) {
                handlePreC_IDENTITY(evm);
            } else if (uint(evm.target.addr) == 5) {
                handlePreC_MODEXP(evm);
            } else if (uint(evm.target.addr) == 6) {
                handlePreC_ECADD(evm);
            } else if (uint(evm.target.addr) == 7) {
                handlePreC_ECMUL(evm);
            } else if (uint(evm.target.addr) == 8) {
                handlePreC_ECPAIRING(evm);
            }
        } else {
            // If there is no code to run, just continue. TODO
            if (evm.target.code.length == 0) {
                return evm;
            }
            evm.code = evm.target.code;
            if (evmInput.stack.size > 0) {
                evm.stack = evmInput.stack;
            } else {
                evm.stack = EVMStack.newStack();
            }
            if (evmInput.mem.size > 0) {
                evm.mem = evmInput.mem;
            } else {
                evm.mem = EVMMemory.newMemory();
            }
            _run(evm, evmInput.pcStart, evmInput.pcStepCount);
        }
    }

    function _create(EVMCreateInput memory evmInput) internal view returns (EVM memory evm, address addr) {
        evm.context = evmInput.context;
        evm.accounts = evmInput.accounts.copy();
        evm.logHash = evmInput.logHash;
        evm.value = evmInput.value;
        evm.gas = evmInput.gas;
        evm.caller = evm.accounts.get(evmInput.caller);

        // Increase the nonce. TODO
        evm.caller.nonce++;

        // Transfer value check. TODO
        if (evm.value > 0) {
            if (evm.caller.balance < evm.value) {
                evm.errno = ERROR_INSUFFICIENT_FUNDS;
                return (evm, addr);
            }
        }

        address newAddress = EVMUtils.newAddress(evm.caller.addr, evm.caller.nonce);
        EVMAccounts.Account memory newAcc = evm.accounts.get(newAddress);

        // TODO
        if (newAcc.nonce != 0) {
            evm.errno = ERROR_CONTRACT_CREATION_COLLISION;
            return (evm, addr);
        }

        evm.caller.balance -= evm.value;
        newAcc.balance += evm.value;

        evm.target = newAcc;
        evm.code = evmInput.code;
        evm.stack = EVMStack.newStack();
        evm.mem = EVMMemory.newMemory();
        _run(evm, 0, 0);

        // TODO
        if (evm.errno != NO_ERROR) {
            return (evm, addr);
        }
        if (evm.returnData.length > MAX_CODE_SIZE) {
            evm.errno = ERROR_MAX_CODE_SIZE_EXCEEDED;
            return (evm, addr);
        }
        newAcc.code = EVMCode.fromBytes(evm.returnData);
        addr = newAddress;
    }

    function stateHash(EVM memory evm, Context memory context) internal pure returns (bytes32) {
        bytes32 contextHash = keccak256(abi.encodePacked(
            context.origin,
            context.gasPrice,
            context.gasLimit,
            context.coinBase,
            context.blockNumber,
            context.time
        ));

        bytes32 dataHash = keccak256(abi.encodePacked(
            evm.gas,
            evm.code,
            evm.data,
            evm.lastRet,
            evm.returnData,
            evm.errno,
            evm.accounts.size
        ));

        bytes32 hashValue = keccak256(abi.encodePacked(
            dataHash,
            evm.logHash,
            evm.mem.size,
            evm.stack.size,
            evm.depth,
            // evm.n,
            evm.pc,
            contextHash
        ));

        return hashValue;
    }

    // solhint-disable-next-line code-complexity, function-max-lines, security/no-assign-params
    function _run(EVM memory evm, uint pc, uint pcStepCount) internal view {
        uint pcNext = 0;
        uint stepRun = 0;

        if (evm.gas > evm.context.gasLimit) {
            evm.errno = ERROR_OUT_OF_GAS;
        }

        while (evm.errno == NO_ERROR && pc < evm.code.length && (pcStepCount == 0 || stepRun < pcStepCount)) {
            uint stackIn;
            uint stackOut;
            uint gasFee;
            uint8 opcode = evm.code.getOpcodeAt(pc);
            function(EVM memory) internal view opcodeHandler;

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
                gasFee = GAS_VERYLOW;
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

            // Check for violation of static execution.
            if (
                evm.staticExec &&
                (opcode == OP_SSTORE || opcode == OP_CREATE || (OP_LOG0 <= opcode && opcode <= OP_LOG4))
            ) {
                evm.errno = ERROR_ILLEGAL_WRITE_OPERATION;
                break;
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
            } else if (opcode == OP_RETURN || opcode == OP_REVERT || opcode == OP_STOP || opcode == OP_SELFDESTRUCT) {
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
    function handlePreC_ECRECOVER(EVM memory state) internal pure {
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
    function handlePreC_SHA256(EVM memory state) internal pure {
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
    function handlePreC_RIPEMD160(EVM memory state) internal pure {
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
    function handlePreC_IDENTITY(EVM memory state) internal pure {
        uint gasFee = GAS_IDENTITY_BASE + (((state.data.length + 31) / 32) * GAS_IDENTITY_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.data;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_MODEXP(EVM memory state) internal pure {
        // TODO
        state.errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECADD(EVM memory state) internal pure {
        // TODO
        state.errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECMUL(EVM memory state) internal pure {
        // TODO
        state.errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECPAIRING(EVM memory state) internal pure {
        // TODO
        state.errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }
    // 0x0X

    // solhint-disable-next-line no-empty-blocks
    function handleSTOP(EVM memory state) internal pure {

    }

    function handleADD(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := add(a, b)
        }
        state.stack.push(c);
    }

    function handleMUL(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mul(a, b)
        }
        state.stack.push(c);
    }

    function handleSUB(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sub(a, b)
        }
        state.stack.push(c);
    }

    function handleDIV(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := div(a, b)
        }
        state.stack.push(c);
    }

    function handleSDIV(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sdiv(a, b)
        }
        state.stack.push(c);
    }

    function handleMOD(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mod(a, b)
        }
        state.stack.push(c);
    }

    function handleSMOD(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := smod(a, b)
        }
        state.stack.push(c);
    }

    function handleADDMOD(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := addmod(a, b, m)
        }
        state.stack.push(c);
    }

    function handleMULMOD(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := mulmod(a, b, m)
        }
        state.stack.push(c);
    }

    function handleEXP(EVM memory state) internal pure {
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

    function handleSIGNEXTEND(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := signextend(a, b)
        }
        state.stack.push(c);
    }

    function handleSHL(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shl(a, b)
        }
        state.stack.push(c);
    }

    function handleSHR(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shr(a, b)
        }
        state.stack.push(c);
    }

    function handleSAR(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sar(a, b)
        }
        state.stack.push(c);
    }

    // 0x1X
    function handleLT(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := lt(a, b)
        }
        state.stack.push(c);
    }

    function handleGT(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := gt(a, b)
        }
        state.stack.push(c);
    }

    function handleSLT(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := slt(a, b)
        }
        state.stack.push(c);
    }

    function handleSGT(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sgt(a, b)
        }
        state.stack.push(c);
    }

    function handleEQ(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := eq(a, b)
        }
        state.stack.push(c);
    }

    function handleISZERO(EVM memory state) internal pure {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := iszero(data)
        }
        state.stack.push(res);
    }

    function handleAND(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := and(a, b)
        }
        state.stack.push(c);
    }

    function handleOR(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := or(a, b)
        }
        state.stack.push(c);
    }

    function handleXOR(EVM memory state) internal pure {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := xor(a, b)
        }
        state.stack.push(c);
    }

    function handleNOT(EVM memory state) internal pure {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := not(data)
        }
        state.stack.push(res);
    }

    function handleBYTE(EVM memory state) internal pure {
        uint n = state.stack.pop();
        uint x = state.stack.pop();
        uint b;
        assembly {
            b := byte(n, x)
        }
        state.stack.push(b);
    }

    // 0x2X
    function handleSHA3(EVM memory state) internal pure {
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

        uint mp = state.mem.memUPtr(p);

        assembly {
            res := keccak256(mp, n)
        }
        state.stack.push(res);
    }

    // 0x3X
    function handleADDRESS(EVM memory state) internal pure {
        state.stack.push(uint(state.target.addr));
    }

    function handleBALANCE(EVM memory state) internal pure {
        state.stack.push(state.accounts.get(address(state.stack.pop())).balance);
    }

    function handleORIGIN(EVM memory state) internal pure {
        state.stack.push(uint(state.context.origin));
    }

    function handleCALLER(EVM memory state) internal pure {
        state.stack.push(uint(state.caller.addr));
    }

    function handleCALLVALUE(EVM memory state) internal pure {
        state.stack.push(state.value);
    }

    function handleCALLDATALOAD(EVM memory state) internal pure {
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

    function handleCALLDATASIZE(EVM memory state) internal pure {
        state.stack.push(state.data.length);
    }

    function handleCALLDATACOPY(EVM memory state) internal pure {
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

    function handleCODESIZE(EVM memory state) internal pure {
        state.stack.push(state.code.length);
    }

    function handleCODECOPY(EVM memory state) internal view {
        uint mAddr = state.stack.pop();
        uint cAddr = state.stack.pop();
        uint len = state.stack.pop();

        if (cAddr + len > state.code.length) {
            state.errno = ERROR_INDEX_OOB;
            return;
        }

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.storeBytes(state.code.toBytes(), cAddr, mAddr, len);
    }

    function handleGASPRICE(EVM memory state) internal pure {
        state.stack.push(state.context.gasPrice);
    }

    function handleEXTCODESIZE(EVM memory state) internal pure {
        state.stack.push(state.accounts.get(address(state.stack.pop())).code.length);
    }

    function handleEXTCODECOPY(EVM memory state) internal view {
        bytes memory code = state.accounts.get(address(state.stack.pop())).code.toBytes();
        uint mAddr = state.stack.pop();
        uint dAddr = state.stack.pop();
        uint len = state.stack.pop();

        if (dAddr + len > code.length) {
            state.errno = ERROR_INDEX_OOB;
            return;
        }

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.mem.storeBytes(code, dAddr, mAddr, len);
    }

    function handleRETURNDATASIZE(EVM memory state) internal pure {
        state.stack.push(state.lastRet.length);
    }

    function handleRETURNDATACOPY(EVM memory state) internal pure {
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
            state.lastRet,
            rAddr,
            mAddr,
            len
        );
    }

    // 0x4X
    function handleBLOCKHASH(EVM memory state) internal pure {
        state.stack.pop();
        state.stack.push(0);
    }

    function handleCOINBASE(EVM memory state) internal pure {
        state.stack.push(state.context.coinBase);
    }

    function handleTIMESTAMP(EVM memory state) internal pure {
        state.stack.push(state.context.time);
    }

    function handleNUMBER(EVM memory state) internal pure {
        state.stack.push(state.context.blockNumber);
    }

    function handleDIFFICULTY(EVM memory state) internal pure {
        state.stack.push(state.context.difficulty);
    }

    function handleGASLIMIT(EVM memory state) internal pure {
        state.stack.push(state.context.gasLimit);
    }

    // 0x5X
    function handlePOP(EVM memory state) internal pure {
        state.stack.pop();
    }

    function handleMLOAD(EVM memory state) internal pure {
        state.stack.push(state.mem.load(state.stack.pop()));
    }

    function handleMSTORE(EVM memory state) internal pure {
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

    function handleMSTORE8(EVM memory state) internal pure {
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

    function handleSLOAD(EVM memory state) internal pure {
        state.stack.push(state.target.stge.load(state.stack.pop()));
    }

    function handleSSTORE(EVM memory state) internal pure {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();

        uint gasFee = GAS_SSET;
        if (val == 0) {
            gasFee = GAS_SRESET;
        }

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }

        state.gas -= gasFee;

        state.target.stge.store(addr, val);
    }

    function handleJUMP(EVM memory state) internal view {
        uint dest = state.stack.pop();
        if (dest >= state.code.length || state.code.getOpcodeAt(dest) != OP_JUMPDEST) {
            state.errno = ERROR_INVALID_JUMP_DESTINATION;
            return;
        }
        state.pc = dest;
    }

    function handleJUMPI(EVM memory state) internal view {
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

    function handlePC(EVM memory state) internal pure {
        state.stack.push(state.pc);
    }

    function handleMSIZE(EVM memory state) internal pure {
        state.stack.push(32 * state.mem.size);
    }

    function handleGAS(EVM memory state) internal pure {
        state.stack.push(state.gas);
    }

    // solhint-disable-next-line no-empty-blocks
    function handleJUMPDEST(EVM memory state) internal pure {

    }

    // 0x6X, 0x7X
    function handlePUSH(EVM memory state) internal view {
        assert(1 <= state.n && state.n <= 32);
        if (state.pc + state.n > state.code.length) {
            state.errno = ERROR_INDEX_OOB;
            return;
        }
        state.stack.push(state.code.toUint(state.pc + 1, state.n));
    }

    // 0x8X
    function handleDUP(EVM memory state) internal pure {
        assert(1 <= state.n && state.n <= 16);
        state.stack.dup(state.n);
    }

    // 0x9X
    function handleSWAP(EVM memory state) internal pure {
        assert(1 <= state.n && state.n <= 16);
        state.stack.swap(state.n);
    }

    // 0xaX
    function handleLOG(EVM memory state) internal pure {
        uint mAddr = state.stack.pop();
        uint mSize = state.stack.pop();
        uint gasFee = GAS_LOG +
            (GAS_LOGTOPIC * state.n) +
            (mSize * GAS_LOGDATA) +
            computeGasForMemory(state, mAddr + mSize);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        EVMLogs.LogEntry memory log;
        log.account = state.target.addr;
        log.data = state.mem.toArray(mAddr, mSize);

        for (uint i = 0; i < state.n; i++) {
            log.topics[i] = state.stack.pop();
        }

        state.logHash = keccak256(
            abi.encodePacked(
                state.logHash,
                log.account,
                log.topics,
                log.data
            )
        );
    }

    // 0xfX
    function handleCREATE(EVM memory state) internal view {
        assert(!state.staticExec);

        EVMCreateInput memory input;
        input.gas = state.gas;
        input.value = state.stack.pop();

        uint memOffset = state.stack.pop();
        uint memSize = state.stack.pop();
        uint gasFee = GAS_CREATE + computeGasForMemory(state, memOffset + memSize);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        input.gas -= gasFee;

        input.code = EVMCode.fromBytes(state.mem.toArray(memOffset, memSize));
        input.caller = state.target.addr;
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;

        EVM memory retEvm;
        address newAddress;
        (retEvm, newAddress) = _create(input);
        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
        } else {
            state.stack.push(uint(newAddress));
            state.accounts = retEvm.accounts;
            state.caller = state.accounts.get(state.caller.addr);
            state.target = state.accounts.get(state.target.addr);
            state.logHash = retEvm.logHash;
        }
        state.gas = retEvm.gas;
    }

    function handleCREATE2(EVM memory state) internal pure {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    // solhint-disable-next-line function-max-lines
    function handleCALL(EVM memory state) internal view {
        EVMInput memory input;

        input.gas = state.stack.pop();
        input.caller = state.target.addr;
        input.target = address(state.stack.pop());
        input.value = state.stack.pop();

        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();

        uint gasFee = GAS_CALL +
            computeGasForMemory(state, retOffset + retSize, inOffset + inSize);

        if (input.value != 0) {
            gasFee += GAS_CALLVALUE;
            state.gas += GAS_CALLSTIPEND;
            input.gas += GAS_CALLSTIPEND;

            EVMAccounts.Account memory acc = state.accounts.get(input.target);

            if (acc.nonce == 0) {
                gasFee += GAS_NEWACCOUNT;
            }
        }

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        if (input.gas > state.gas) {
            input.gas = state.gas;
        }

        input.data = state.mem.toArray(inOffset, inSize);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.staticExec = state.staticExec;

        // solhint-disable-next-line avoid-low-level-calls
        EVM memory retEvm = _call(input, CallType.Call);
        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
            state.lastRet = new bytes(0);
        } else {
            state.stack.push(1);
            state.mem.storeBytesAndPadWithZeroes(retEvm.returnData, 0, retOffset, retSize);
            state.lastRet = retEvm.returnData;
            // Update to the new state.
            state.accounts = retEvm.accounts;
            state.caller = state.accounts.get(state.caller.addr);
            state.target = state.accounts.get(state.target.addr);
            state.logHash = retEvm.logHash;
        }
        state.gas -= input.gas - retEvm.gas;
    }

    function handleCALLCODE(EVM memory state) internal pure {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleRETURN(EVM memory state) internal pure {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toArray(start, len);
    }

    // solhint-disable-next-line function-max-lines
    function handleDELEGATECALL(EVM memory state) internal view {
        EVMInput memory input;

        input.gas = state.stack.pop();
        EVMCode.Code memory oldCode = state.target.code;
        state.target.code = state.accounts.get(address(state.stack.pop())).code;
        input.target = state.target.addr;

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

        if (input.gas > state.gas) {
            input.gas = state.gas;
        }

        input.data = state.mem.toArray(inOffset, inSize);
        input.value = state.value;
        input.caller = state.caller.addr;
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.staticExec = state.staticExec;

        // solhint-disable-next-line avoid-low-level-calls
        EVM memory retEvm = _call(input, CallType.DelegateCall);

        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
            state.lastRet = new bytes(0);
        } else {
            state.stack.push(1);
            state.mem.storeBytesAndPadWithZeroes(retEvm.returnData, 0, retOffset, retSize);
            state.lastRet = retEvm.returnData;
            state.accounts = retEvm.accounts;
            state.caller = state.accounts.get(state.caller.addr);
            state.target = state.accounts.get(state.target.addr);
            state.logHash = retEvm.logHash;
        }
        state.target.code = oldCode;
        state.gas -= input.gas - retEvm.gas;
    }

    function handleSTATICCALL(EVM memory state) internal view {
        EVMInput memory input;

        input.gas = state.stack.pop();
        input.caller = state.target.addr;
        input.target = address(state.stack.pop());

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

        if (input.gas > state.gas) {
            input.gas = state.gas;
        }

        input.data = state.mem.toArray(inOffset, inSize);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.staticExec = true;

        // solhint-disable-next-line avoid-low-level-calls
        EVM memory retEvm = _call(input, CallType.StaticCall);
        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
            state.lastRet = new bytes(0);
        } else {
            state.stack.push(1);
            state.mem.storeBytesAndPadWithZeroes(retEvm.returnData, 0, retOffset, retSize);
            state.lastRet = retEvm.returnData;
            state.logHash = retEvm.logHash;
        }
        state.gas -= input.gas - retEvm.gas;
    }

    function handleREVERT(EVM memory state) internal pure {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toArray(start, len);
        state.errno = ERROR_STATE_REVERTED;
    }

    function handleINVALID(EVM memory evm) internal pure {
        evm.errno = ERROR_INVALID_OPCODE;
    }

    function handleSELFDESTRUCT(EVM memory state) internal pure {
        // receiver
        EVMAccounts.Account memory acc = state.accounts.get(address(state.stack.pop()));

        if (GAS_SELFDESTRUCT > state.gas) {
            state.gas = 0;
            state.errno = ERROR_OUT_OF_GAS;
            return;
        }
        state.gas -= GAS_SELFDESTRUCT;

        if (state.target.balance > 0) {
            if (acc.nonce == 0) {
                // assuming new account created!?
                if (GAS_NEWACCOUNT > state.gas) {
                    state.gas = 0;
                    state.errno = ERROR_OUT_OF_GAS;
                    return;
                }
                state.gas -= GAS_NEWACCOUNT;
            }

            acc.balance += state.target.balance;
            state.target.balance = 0;
        }

        state.target.destroyed = true;
    }
}
