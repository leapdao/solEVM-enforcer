pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;


import { EVMConstants } from "./EVMConstants.sol";
import { EVMAccounts } from "./EVMAccounts.slb";
import { EVMStorage } from "./EVMStorage.slb";
import { EVMMemory } from "./EVMMemory.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMLogs } from "./EVMLogs.slb";
import { EVMUtils } from "./EVMUtils.slb";


contract IEthereumRuntime is EVMConstants {
    
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
        uint64 gas;
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
    
    struct Result {
        uint errno;
        uint errpc;
        bytes returnData;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        uint[] logs;
        bytes logsData;
    }
    
    // ************* Only used internally *************
    struct Instruction {
        function(EVM memory) internal pure returns (uint) handler;
        uint stackIn;
        uint stackOut;
        uint gas;
    }
    
    struct EVMInput {
        uint64 gas;
        uint value;
        bytes data;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        EVMLogs.Logs logs;
        Handlers handlers;
        bool staticExec;
    }
    
    struct EVMCreateInput {
        uint64 gas;
        uint value;
        bytes code;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        EVMLogs.Logs logs;
        Handlers handlers;
    }
    
    struct Handlers {
        Instruction[256] ins;
        function(bytes memory input) internal pure returns (bytes memory ret, uint errno)[9] p;
    }
    
    struct EVM {
        uint64 gas;
        uint value;
        bytes code;
        bytes data;
        bytes lastRet;
        bytes returnData;
        uint errno;
        uint errpc;
        
        EVMAccounts.Accounts accounts;
        EVMLogs.Logs logs;
        Context context;
        EVMMemory.Memory mem;
        EVMStack.Stack stack;
        
        uint depth;
        
        EVMAccounts.Account caller;
        EVMAccounts.Account target;
        uint n;
        uint pc;
        
        bool staticExec;
        Handlers handlers;
    }
    
    // Execute the EVM with the given code and call-data.
    function execute(bytes memory code, bytes memory data) public pure returns (Result memory result);
    
    // Execute the EVM with the given transaction input.
    function execute(TxInput memory input) public pure returns (Result memory result);
    
    // Execute the EVM with the given transaction input and context.
    function execute(TxInput memory input, Context memory context) public pure returns (Result memory result);
    
}


contract EthereumRuntime is IEthereumRuntime {
    
    // Execute the EVM with the given code and call-data.
    function executeFlat(
        bytes memory code, bytes memory data
    ) public pure returns (uint, uint, bytes, uint[], bytes, uint[], bytes, uint[], bytes) {
        Result memory result = execute(code, data);
        return (
            result.errno, result.errpc, result.returnData, result.stack,
            result.mem, result.accounts, result.accountsCode, result.logs, result.logsData
        );
    }

    function execute(bytes memory code, bytes memory data) public pure returns (Result memory result) {
        return execute(code, data, 0);
    }
    
    function execute(bytes memory code, bytes memory data, uint pcTill) public pure returns (Result memory result) {
        
        TxInput memory input = TxInput(
            0,
            0,
            DEFAULT_CALLER,
            0,
            0,
            DEFAULT_CONTRACT_ADDRESS,
            0,
            code,
            data,
            false
        );
        
        Context memory context = Context(
            DEFAULT_CALLER,
            0,
            0,
            0,
            0,
            0,
            0
        );
        return execute(input, context, pcTill);
    }
    
    function execute(TxInput memory input) public pure returns (Result memory result) {
        Context memory context = Context(
            input.caller,
            0,
            0,
            0,
            0,
            0,
            0
        );
        return execute(input, context);
    }
    
    function execute(TxInput memory input, Context memory context, uint pcTill) public pure returns (Result memory result) {
        EVMInput memory evmInput;
        evmInput.context = context;
        evmInput.handlers = _newHandlers();
        evmInput.data = input.data;
        evmInput.value = input.value;
        
        EVMAccounts.Account memory caller = evmInput.accounts.get(input.caller);
        caller.balance = input.callerBalance;
        if (!input.staticExec) {
            caller.nonce = uint8(1);
        }
        evmInput.caller = input.caller;
        
        EVMAccounts.Account memory target = evmInput.accounts.get(input.target);
        target.balance = input.targetBalance;
        target.code = input.targetCode;
        evmInput.target = input.target;
        evmInput.staticExec = input.staticExec;
        
        // solhint-disable-next-line avoid-low-level-calls
        EVM memory evm = _call(evmInput, input.staticExec ? CallType.StaticCall : CallType.Call, pcTill);
        
        result.stack = evm.stack.toArray();
        result.mem = evm.mem.toArray();
        result.returnData = evm.returnData;
        result.errno = evm.errno;
        result.errpc = evm.errpc;
        // TODO handle accounts that result from a failed transaction.
        (result.accounts, result.accountsCode) = evm.accounts.toArray();
        (result.logs, result.logsData) = evm.logs.toArray();
        return;
    }

    // Execute the EVM with the given code and call-data until the given op-count.
    function executeAndStop(bytes memory code, bytes memory data, uint pcTill) public pure returns (uint, uint, bytes, uint[], bytes, uint[], bytes, uint[], bytes) {
        Result memory result = execute(code, data, pcTill);
        return (result.errno, result.errpc, result.returnData, result.stack, result.mem, result.accounts, result.accountsCode, result.logs, result.logsData);
    }
    
    function _call(EVMInput memory evmInput, CallType callType, uint pcTill) internal pure returns (EVM memory evm) {
        evm.context = evmInput.context;
        evm.handlers = evmInput.handlers;
        if (evmInput.staticExec) {
            evm.accounts = evmInput.accounts;
            evm.logs = evmInput.logs;
        } else {
            evm.accounts = evmInput.accounts.copy();
            evm.logs = evmInput.logs.copy();
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
                return;
            }
            if (evm.caller.balance < evm.value) {
                evm.errno = ERROR_INSUFFICIENT_FUNDS;
                return;
            }
            evm.caller.balance -= evm.value;
            evm.target.balance += evm.value;
        }
        
        if (1 <= evm.target.addr && evm.target.addr <= 8) {
            (evm.returnData, evm.errno) = evm.handlers.p[uint(evm.target.addr)](evm.data);
        } else {
            // If there is no code to run, just continue. TODO
            if (evm.target.code.length == 0) {
                return;
            }
            evm.code = evm.target.code;
            
            evm.stack = EVMStack.newStack();
            evm.mem = EVMMemory.newMemory();
            _run(evm, 0, pcTill);
        }
    }
    
    function _create(EVMCreateInput memory evmInput) internal pure returns (EVM memory evm, address addr) {
        evm.context = evmInput.context;
        evm.handlers = evmInput.handlers;
        evm.accounts = evmInput.accounts.copy();
        evm.logs = evmInput.logs.copy();
        evm.value = evmInput.value;
        evm.gas = evmInput.gas;
        evm.caller = evm.accounts.get(evmInput.caller);
        
        // Increase the nonce. TODO
        evm.caller.nonce++;
        
        // Transfer value check. TODO
        if (evm.value > 0) {
            if (evm.caller.balance < evm.value) {
                evm.errno = ERROR_INSUFFICIENT_FUNDS;
                return;
            }
        }
        
        address newAddress = EVMUtils.newAddress(evm.caller.addr, evm.caller.nonce);
        EVMAccounts.Account memory newAcc = evm.accounts.get(newAddress);
        
        // TODO
        if (newAcc.nonce != 0) {
            evm.errno = ERROR_CONTRACT_CREATION_COLLISION;
            return;
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
            return;
        }
        if (evm.returnData.length > MAX_CODE_SIZE) {
            evm.errno = ERROR_MAX_CODE_SIZE_EXCEEDED;
            return;
        }
        newAcc.code = evm.returnData;
        addr = newAddress;
    }

    // solhint-disable-next-line code-complexity, function-max-lines
    function _run(EVM memory evm, uint pc, uint pcTill) internal pure {

        uint pcNext = 0;
        uint errno = NO_ERROR;
        bytes memory code = evm.code;
        if (pcTill == 0) {
            pcTill = code.length;
        }

        while (errno == NO_ERROR && pc < pcTill) {
            uint opcode = uint(code[pc]);
            
            // Check for violation of static execution.
            if (
                evm.staticExec && 
                (opcode == OP_SSTORE || opcode == OP_CREATE || (OP_LOG0 <= opcode && opcode <= OP_LOG4))
            ) {
                errno = ERROR_ILLEGAL_WRITE_OPERATION;
                break;
            }
                
            Instruction memory ins = evm.handlers.ins[opcode];
            
            // Check for stack errors
            if (evm.stack.size < ins.stackIn) {
                errno = ERROR_STACK_UNDERFLOW;
                break;
            } else if (ins.stackOut > ins.stackIn && evm.stack.size + ins.stackOut - ins.stackIn > MAX_STACK_SIZE) {
                errno = ERROR_STACK_OVERFLOW;
                break;
            }
            
            if (OP_PUSH1 <= opcode && opcode <= OP_PUSH32) {
                evm.pc = pc;
                uint n = opcode - OP_PUSH1 + 1;
                evm.n = n;
                errno = ins.handler(evm);
                pcNext = pc + n + 1;
            } else if (opcode == OP_JUMP || opcode == OP_JUMPI) {
                evm.pc = pc;
                errno = ins.handler(evm);
                pcNext = evm.pc;
            } else if (opcode == OP_RETURN || opcode == OP_REVERT || opcode == OP_STOP || opcode == OP_SELFDESTRUCT) {
                errno = ins.handler(evm);
                break;
            } else {
                if (OP_DUP1 <= opcode && opcode <= OP_DUP16) {
                    evm.n = opcode - OP_DUP1 + 1;
                    errno = ins.handler(evm);
                } else if (OP_SWAP1 <= opcode && opcode <= OP_SWAP16) {
                    evm.n = opcode - OP_SWAP1 + 1;
                    errno = ins.handler(evm);
                } else if (OP_LOG0 <= opcode && opcode <= OP_LOG4) {
                    evm.n = opcode - OP_LOG0;
                    errno = ins.handler(evm);
                } else if (opcode == OP_PC) {
                    evm.pc = pc;
                    errno = ins.handler(evm);
                } else {
                    errno = ins.handler(evm);
                }
                pcNext = pc + 1;
            }
            if (errno == NO_ERROR) {
                pc = pcNext;
            }
        }
        evm.errno = errno;
        // to be used if errno is non-zero
        evm.errpc = pc;
    }
    
    // ************************* Handlers ***************************
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECRECOVER(bytes memory input) internal pure returns (bytes memory ret, uint errno) {
        uint hash = EVMUtils.toUint(input, 0, 32);
        uint v = uint8(EVMUtils.toUint(input, 32, 32));
        uint r = EVMUtils.toUint(input, 64, 32);
        uint s = EVMUtils.toUint(input, 96, 32);
        address result = ecrecover(bytes32(hash), uint8(v), bytes32(r), bytes32(s));
        ret = EVMUtils.fromUint(uint(result));
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_SHA256(bytes memory input) internal pure returns (bytes memory ret, uint errno) {
        bytes32 result = sha256(input);
        ret = EVMUtils.fromUint(uint(result));
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_RIPEMD160(bytes memory input) internal pure returns (bytes memory ret, uint errno) {
        bytes20 result = ripemd160(input);
        ret = EVMUtils.fromUint(uint(result));
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_IDENTITY(bytes memory input) internal pure returns (bytes memory ret, uint errno) {
        ret = input;
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_UNIMPLEMENTED(bytes memory) internal pure returns (bytes memory ret, uint errno) {
        errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }
    // 0x0X
    
    // solhint-disable-next-line no-empty-blocks
    function handleSTOP(EVM memory state) internal pure returns (uint) {
        
    }
    
    function handleADD(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := add(a, b)
        }
        state.stack.push(c);
    }
    
    function handleMUL(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mul(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSUB(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sub(a, b)
        }
        state.stack.push(c);
    }
    
    function handleDIV(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := div(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSDIV(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sdiv(a, b)
        }
        state.stack.push(c);
    }
    
    function handleMOD(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := mod(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSMOD(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := smod(a, b)
        }
        state.stack.push(c);
    }
    
    function handleADDMOD(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := addmod(a, b, m)
        }
        state.stack.push(c);
    }
    
    function handleMULMOD(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint m = state.stack.pop();
        uint c;
        assembly {
            c := mulmod(a, b, m)
        }
        state.stack.push(c);
    }
    
    function handleEXP(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := exp(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSIGNEXTEND(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := signextend(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSHL(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shl(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSHR(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := shr(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSAR(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sar(a, b)
        }
        state.stack.push(c);
    }
    
    // 0x1X
    function handleLT(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := lt(a, b)
        }
        state.stack.push(c);
    }
    
    function handleGT(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := gt(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSLT(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := slt(a, b)
        }
        state.stack.push(c);
    }
    
    function handleSGT(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := sgt(a, b)
        }
        state.stack.push(c);
    }
    
    function handleEQ(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := eq(a, b)
        }
        state.stack.push(c);
    }
    
    function handleISZERO(EVM memory state) internal pure returns (uint) {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := iszero(data)
        }
        state.stack.push(res);
    }
    
    function handleAND(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := and(a, b)
        }
        state.stack.push(c);
    }
    
    function handleOR(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := or(a, b)
        }
        state.stack.push(c);
    }
    
    function handleXOR(EVM memory state) internal pure returns (uint) {
        uint a = state.stack.pop();
        uint b = state.stack.pop();
        uint c;
        assembly {
            c := xor(a, b)
        }
        state.stack.push(c);
    }
    
    function handleNOT(EVM memory state) internal pure returns (uint) {
        uint data = state.stack.pop();
        uint res;
        assembly {
            res := not(data)
        }
        state.stack.push(res);
    }
    
    function handleBYTE(EVM memory state) internal pure returns (uint) {
        uint n = state.stack.pop();
        uint x = state.stack.pop();
        uint b;
        assembly {
            b := byte(n, x)
        }
        state.stack.push(b);
    }
    
    // 0x2X
    function handleSHA3(EVM memory state) internal pure returns (uint) {
        uint p = state.stack.pop();
        uint n = state.stack.pop();
        uint mp = state.mem.memUPtr(p);
        uint res;
        assembly {
            res := keccak256(mp, n)
        }
        state.stack.push(res);
    }
    
    // 0x3X
    function handleADDRESS(EVM memory state) internal pure returns (uint) {
        state.stack.push(uint(state.target.addr));
    }
    
    function handleBALANCE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        state.stack.push(state.accounts.get(address(addr)).balance);
    }
    
    function handleORIGIN(EVM memory state) internal pure returns (uint) {
        state.stack.push(uint(state.context.origin));
    }
    
    function handleCALLER(EVM memory state) internal pure returns (uint) {
        state.stack.push(uint(state.caller.addr));
    }
    
    function handleCALLVALUE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.value);
    }
    
    function handleCALLDATALOAD(EVM memory state) internal pure returns (uint) {
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
    
    function handleCALLDATASIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.data.length);
    }
    
    function handleCALLDATACOPY(EVM memory state) internal pure returns (uint) {
        uint mAddr = state.stack.pop();
        uint dAddr = state.stack.pop();
        uint len = state.stack.pop();
        state.mem.storeBytesAndPadWithZeroes(state.data, dAddr, mAddr, len);
    }
    
    function handleCODESIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.code.length);
    }
    
    function handleCODECOPY(EVM memory state) internal pure returns (uint) {
        uint mAddr = state.stack.pop();
        uint cAddr = state.stack.pop();
        uint len = state.stack.pop();
        if (cAddr + len > state.code.length) {
            return ERROR_INDEX_OOB;
        }
        state.mem.storeBytes(state.code, cAddr, mAddr, len);
    }
    
    function handleGASPRICE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.gasPrice);
    }
    
    function handleEXTCODESIZE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        state.stack.push(state.accounts.get(address(addr)).code.length);
    }
    
    function handleEXTCODECOPY(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint mAddr = state.stack.pop();
        uint dAddr = state.stack.pop();
        uint len = state.stack.pop();
        bytes memory code = state.accounts.get(address(addr)).code;
        if (dAddr + len > code.length) {
            return ERROR_INDEX_OOB;
        }
        state.mem.storeBytes(code, dAddr, mAddr, len);
    }
    
    function handleRETURNDATASIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.lastRet.length);
    }
    
    function handleRETURNDATACOPY(EVM memory state) internal pure returns (uint) {
        uint mAddr = state.stack.pop();
        uint rAddr = state.stack.pop();
        uint len = state.stack.pop();
        state.mem.storeBytesAndPadWithZeroes(state.lastRet, rAddr, mAddr, len);
    }
    
    // 0x4X
    function handleBLOCKHASH(EVM memory state) internal pure returns (uint) {
        state.stack.pop();
        state.stack.push(0);
    }
    
    function handleCOINBASE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.coinBase);
    }
    
    function handleTIMESTAMP(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.time);
    }
    
    function handleNUMBER(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.blockNumber);
    }
    
    function handleDIFFICULTY(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.difficulty);
    }
    
    function handleGASLIMIT(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.gasLimit);
    }
    
    // 0x5X
    function handlePOP(EVM memory state) internal pure returns (uint) {
        state.stack.pop();
    }
    
    function handleMLOAD(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        state.stack.push(state.mem.load(addr));
    }
    
    function handleMSTORE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();
        state.mem.store(addr, val);
    }
    
    function handleMSTORE8(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();
        state.mem.store8(addr, uint8(val));
    }
    
    function handleSLOAD(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.target.stge.load(addr);
        state.stack.push(val);
    }
    
    function handleSSTORE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();
        state.target.stge.store(addr, val);
    }
    
    function handleJUMP(EVM memory state) internal pure returns (uint) {
        uint dest = state.stack.pop();
        if (dest >= state.code.length || uint(state.code[dest]) != OP_JUMPDEST) {
            return ERROR_INVALID_JUMP_DESTINATION;
        }
        state.pc = dest;
    }
    
    function handleJUMPI(EVM memory state) internal pure returns (uint) {
        uint dest = state.stack.pop();
        uint cnd = state.stack.pop();
        if (cnd == 0) {
            state.pc = state.pc + 1;
            return;
        }
        if (dest >= state.code.length || uint(state.code[dest]) != OP_JUMPDEST) {
            return ERROR_INVALID_JUMP_DESTINATION;
        }
        state.pc = dest;
    }
    
    function handlePC(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.pc);
    }
    
    function handleMSIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(32 * state.mem.size);
    }
    
    function handleGAS(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.gas);
    }
    
    // solhint-disable-next-line no-empty-blocks
    function handleJUMPDEST(EVM memory state) internal pure returns (uint) {
        
    }
    
    // 0x6X, 0x7X
    function handlePUSH(EVM memory state) internal pure returns (uint) {
        assert(1 <= state.n && state.n <= 32);
        if (state.pc + state.n > state.code.length) {
            return ERROR_INDEX_OOB;
        }
        state.stack.push(EVMUtils.toUint(state.code, state.pc + 1, state.n));
    }
    
    // 0x8X
    function handleDUP(EVM memory state) internal pure returns (uint) {
        assert(1 <= state.n && state.n <= 16);
        state.stack.dup(state.n);
    }
    
    // 0x9X
    function handleSWAP(EVM memory state) internal pure returns (uint) {
        assert(1 <= state.n && state.n <= 16);
        state.stack.swap(state.n);
    }
    
    // 0xaX
    function handleLOG(EVM memory state) internal pure returns (uint) {
        EVMLogs.LogEntry memory log;
        log.account = state.target.addr;
        uint mAddr = state.stack.pop();
        uint mSize = state.stack.pop();
        for (uint i = 0; i < state.n; i++) {
            log.topics[i] = state.stack.pop();
        }
        log.data = state.mem.toArray(mAddr, mSize);
        state.logs.add(log);
    }
    
    // 0xfX
    function handleCREATE(EVM memory state) internal pure returns (uint) {
        assert(!state.staticExec);
        
        uint value = state.stack.pop();
        uint memPos = state.stack.pop();
        uint size = state.stack.pop();
        EVMCreateInput memory input;
        // TODO gas
        input.value = value;
        input.code = state.mem.toArray(memPos, size);
        input.caller = state.target.addr;
        input.context = state.context;
        input.accounts = state.accounts;
        input.logs = state.logs;
        input.handlers = state.handlers;
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
            state.logs = retEvm.logs;
        }
        
    }
    
    function handleCREATE2(EVM memory) internal pure returns (uint) {
        return ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
    
    function handleCALL(EVM memory state) internal pure returns (uint) {
        state.stack.pop();
        // gas
        uint targetAddr = state.stack.pop();
        uint value = state.stack.pop();
        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        
        uint retOffset = state.stack.pop();
        // return offset
        uint retSize = state.stack.pop();
        // return size
        
        EVMInput memory input;
        // TODO gas
        input.value = value;
        input.data = state.mem.toArray(inOffset, inSize);
        input.caller = state.target.addr;
        input.target = address(targetAddr);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logs = state.logs;
        input.handlers = state.handlers;
        input.staticExec = state.staticExec;

        EVM memory retEvm = _call(input, CallType.Call, 0);
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
            state.logs = retEvm.logs;
        }
    }
    
    function handleCALLCODE(EVM memory) internal pure returns (uint) {
        return ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
    
    function handleRETURN(EVM memory state) internal pure returns (uint) {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        state.returnData = state.mem.toArray(start, len);
    }
    
    function handleDELEGATECALL(EVM memory state) internal pure returns (uint) {
        // gas
        state.stack.pop();
        uint targetAddr = state.stack.pop();
        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();
        
        EVMInput memory input;
        // TODO gas
        input.data = state.mem.toArray(inOffset, inSize);
        input.value = state.value;
        input.caller = state.caller.addr;
        bytes memory callCode = state.accounts.get(address(targetAddr)).code;
        bytes memory oldCode = state.target.code;
        input.target = state.target.addr;
        state.target.code = callCode;
        
        input.context = state.context;
        input.accounts = state.accounts;
        input.logs = state.logs;
        input.handlers = state.handlers;
        input.staticExec = state.staticExec;

        EVM memory retEvm = _call(input, CallType.DelegateCall, 0);

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
            state.logs = retEvm.logs;
        }
        state.target.code = oldCode;
    }
    
    function handleSTATICCALL(EVM memory state) internal pure returns (uint) {
        // gas
        state.stack.pop();
        uint targetAddr = state.stack.pop();
        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();
        
        EVMInput memory input;
        // TODO gas
        input.data = state.mem.toArray(inOffset, inSize);
        input.caller = state.target.addr;
        input.target = address(targetAddr);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logs = state.logs;
        input.handlers = state.handlers;
        input.staticExec = true;

        EVM memory retEvm = _call(input, CallType.StaticCall, 0);
        if (retEvm.errno != NO_ERROR) {
            state.stack.push(0);
            state.lastRet = new bytes(0);
        } else {
            state.stack.push(1);
            state.mem.storeBytesAndPadWithZeroes(retEvm.returnData, 0, retOffset, retSize);
            state.lastRet = retEvm.returnData;
        }
    }
    
    function handleREVERT(EVM memory state) internal pure returns (uint) {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        state.returnData = state.mem.toArray(start, len);
        return ERROR_STATE_REVERTED;
    }
    
    function handleINVALID(EVM memory) internal pure returns (uint) {
        return ERROR_INVALID_OPCODE;
    }
    
    function handleSELFDESTRUCT(EVM memory state) internal pure returns (uint) {
        address receiver = address(state.stack.pop());
        uint bal = state.target.balance;
        state.target.balance = 0;
        state.accounts.get(receiver).balance += bal;
        state.target.destroyed = true;
    }
    
    // Since reference types can't be constant.
    // solhint-disable-next-line function-max-lines
    function _newHandlers() internal pure returns (Handlers memory handlers) {
        Instruction memory inv = Instruction(handleINVALID, 0, 0, 0);
        Instruction memory push = Instruction(handlePUSH, 0, 1, GAS_VERYLOW);
        
        handlers.ins = [
            // 0x0X
            Instruction(handleSTOP, 0, 0, GAS_ZERO),
            Instruction(handleADD, 2, 1, GAS_VERYLOW),
            Instruction(handleMUL, 2, 1, GAS_LOW),
            Instruction(handleSUB, 2, 1, GAS_VERYLOW),
            Instruction(handleDIV, 2, 1, GAS_LOW),
            Instruction(handleSDIV, 2, 1, GAS_LOW),
            Instruction(handleMOD, 2, 1, GAS_LOW),
            Instruction(handleSMOD, 2, 1, GAS_LOW),
            Instruction(handleADDMOD, 3, 1, GAS_MID),
            Instruction(handleMULMOD, 3, 1, GAS_MID),
            Instruction(handleEXP, 2, 1, GAS_EXP),
            Instruction(handleSIGNEXTEND, 0, 0, GAS_LOW),
            inv,
            inv,
            inv,
            inv,
            // 0x1X
            Instruction(handleLT, 2, 1, GAS_VERYLOW),
            Instruction(handleGT, 2, 1, GAS_VERYLOW),
            Instruction(handleSLT, 2, 1, GAS_VERYLOW),
            Instruction(handleSGT, 2, 1, GAS_VERYLOW),
            Instruction(handleEQ, 2, 1, GAS_VERYLOW),
            Instruction(handleISZERO, 1, 1, GAS_VERYLOW),
            Instruction(handleAND, 2, 1, GAS_VERYLOW),
            Instruction(handleOR, 2, 1, GAS_VERYLOW),
            Instruction(handleXOR, 2, 1, GAS_VERYLOW),
            Instruction(handleNOT, 1, 1, GAS_VERYLOW),
            Instruction(handleBYTE, 2, 1, GAS_VERYLOW),
            Instruction(handleSHL, 2, 1, GAS_VERYLOW),
            Instruction(handleSHR, 2, 1, GAS_VERYLOW),
            Instruction(handleSAR, 2, 1, GAS_VERYLOW),
            inv,
            inv,
            // 0x2X
            Instruction(handleSHA3, 2, 1, GAS_SHA3),
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0x3X
            Instruction(handleADDRESS, 0, 1, GAS_BASE),
            Instruction(handleBALANCE, 1, 1, GAS_BALANCE),
            Instruction(handleORIGIN, 0, 1, GAS_BASE),
            Instruction(handleCALLER, 0, 1, GAS_BASE),
            Instruction(handleCALLVALUE, 0, 1, GAS_BASE),
            Instruction(handleCALLDATALOAD, 1, 1, GAS_VERYLOW),
            Instruction(handleCALLDATASIZE, 0, 1, GAS_BASE),
            Instruction(handleCALLDATACOPY, 3, 0, GAS_VERYLOW),
            Instruction(handleCODESIZE, 0, 1, GAS_BASE),
            Instruction(handleCODECOPY, 3, 0, GAS_VERYLOW),
            Instruction(handleGASPRICE, 0, 1, GAS_BASE),
            Instruction(handleEXTCODESIZE, 1, 1, GAS_EXTCODE),
            Instruction(handleEXTCODECOPY, 4, 0, GAS_EXTCODE),
            Instruction(handleRETURNDATASIZE, 0, 1, GAS_BASE),
            Instruction(handleRETURNDATACOPY, 3, 0, GAS_VERYLOW),
            inv,
            // 0x4X
            Instruction(handleBLOCKHASH, 1, 1, GAS_BLOCKHASH),
            Instruction(handleCOINBASE, 0, 1, GAS_BASE),
            Instruction(handleTIMESTAMP, 0, 1, GAS_BASE),
            Instruction(handleNUMBER, 0, 1, GAS_BASE),
            Instruction(handleDIFFICULTY, 0, 1, GAS_BASE),
            Instruction(handleGASLIMIT, 0, 1, GAS_BASE),
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0x5X
            Instruction(handlePOP, 1, 0, GAS_BASE),
            Instruction(handleMLOAD, 1, 1, GAS_VERYLOW),
            Instruction(handleMSTORE, 2, 0, GAS_VERYLOW),
            Instruction(handleMSTORE8, 2, 0, GAS_VERYLOW),
            Instruction(handleSLOAD, 1, 1, GAS_SLOAD),
            Instruction(handleSSTORE, 2, 0, GAS_ZERO),
            Instruction(handleJUMP, 1, 0, GAS_MID),
            Instruction(handleJUMPI, 2, 0, GAS_HIGH),
            Instruction(handlePC, 0, 1, GAS_BASE),
            Instruction(handleMSIZE, 0, 1, GAS_BASE),
            Instruction(handleGAS, 0, 1, GAS_BASE),
            Instruction(handleJUMPDEST, 0, 0, GAS_JUMPDEST),
            inv,
            inv,
            inv,
            inv,
            // 0x6X
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            // 0x7X
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            push,
            // 0x8X
            Instruction(handleDUP, 1, 2, GAS_VERYLOW),
            Instruction(handleDUP, 2, 3, GAS_VERYLOW),
            Instruction(handleDUP, 3, 4, GAS_VERYLOW),
            Instruction(handleDUP, 4, 5, GAS_VERYLOW),
            Instruction(handleDUP, 5, 6, GAS_VERYLOW),
            Instruction(handleDUP, 6, 7, GAS_VERYLOW),
            Instruction(handleDUP, 7, 8, GAS_VERYLOW),
            Instruction(handleDUP, 8, 9, GAS_VERYLOW),
            Instruction(handleDUP, 9, 10, GAS_VERYLOW),
            Instruction(handleDUP, 10, 11, GAS_VERYLOW),
            Instruction(handleDUP, 11, 12, GAS_VERYLOW),
            Instruction(handleDUP, 12, 13, GAS_VERYLOW),
            Instruction(handleDUP, 13, 14, GAS_VERYLOW),
            Instruction(handleDUP, 14, 15, GAS_VERYLOW),
            Instruction(handleDUP, 15, 16, GAS_VERYLOW),
            Instruction(handleDUP, 16, 17, GAS_VERYLOW),
            // 0x9X
            Instruction(handleSWAP, 2, 2, GAS_VERYLOW),
            Instruction(handleSWAP, 3, 3, GAS_VERYLOW),
            Instruction(handleSWAP, 4, 4, GAS_VERYLOW),
            Instruction(handleSWAP, 5, 5, GAS_VERYLOW),
            Instruction(handleSWAP, 6, 6, GAS_VERYLOW),
            Instruction(handleSWAP, 7, 7, GAS_VERYLOW),
            Instruction(handleSWAP, 8, 8, GAS_VERYLOW),
            Instruction(handleSWAP, 9, 9, GAS_VERYLOW),
            Instruction(handleSWAP, 10, 10, GAS_VERYLOW),
            Instruction(handleSWAP, 11, 11, GAS_VERYLOW),
            Instruction(handleSWAP, 12, 12, GAS_VERYLOW),
            Instruction(handleSWAP, 13, 13, GAS_VERYLOW),
            Instruction(handleSWAP, 14, 14, GAS_VERYLOW),
            Instruction(handleSWAP, 15, 15, GAS_VERYLOW),
            Instruction(handleSWAP, 16, 16, GAS_VERYLOW),
            Instruction(handleSWAP, 17, 17, GAS_VERYLOW),
            // 0xaX
            Instruction(handleLOG, 2, 0, GAS_LOG),
            Instruction(handleLOG, 3, 0, GAS_LOG + GAS_LOGTOPIC),
            Instruction(handleLOG, 4, 0, GAS_LOG + 2 * GAS_LOGTOPIC),
            Instruction(handleLOG, 5, 0, GAS_LOG + 3 * GAS_LOGTOPIC),
            Instruction(handleLOG, 6, 0, GAS_LOG + 4 * GAS_LOGTOPIC),
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0xbX
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0xcX
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0xdX
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0xeX
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            inv,
            // 0xfX
            Instruction(handleCREATE, 3, 1, GAS_CREATE),
            Instruction(handleCALL, 7, 1, GAS_CALL),
            Instruction(handleCALLCODE, 7, 1, GAS_CALL),
            Instruction(handleRETURN, 2, 0, GAS_ZERO),
            Instruction(handleDELEGATECALL, 6, 1, GAS_CALL),
            inv,
            inv,
            inv,
            inv,
            inv,
            Instruction(handleSTATICCALL, 6, 1, GAS_CALL),
            inv,
            inv,
            Instruction(handleREVERT, 2, 0, GAS_ZERO),
            inv,
            Instruction(handleSELFDESTRUCT, 1, 0, GAS_SELFDESTRUCT)
        ];
        
        handlers.p[1] = handlePreC_ECRECOVER;
        handlers.p[2] = handlePreC_SHA256;
        handlers.p[3] = handlePreC_RIPEMD160;
        handlers.p[4] = handlePreC_IDENTITY;
        handlers.p[5] = handlePreC_UNIMPLEMENTED;
        handlers.p[6] = handlePreC_UNIMPLEMENTED;
        handlers.p[7] = handlePreC_UNIMPLEMENTED;
        handlers.p[8] = handlePreC_UNIMPLEMENTED;
    }
    
}