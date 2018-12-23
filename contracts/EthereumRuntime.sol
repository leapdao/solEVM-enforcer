pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "./IEthereumRuntime.sol";

import { EVMConstants } from "./EVMConstants.sol";
import { EVMAccounts } from "./EVMAccounts.slb";
import { EVMStorage } from "./EVMStorage.slb";
import { EVMMemory } from "./EVMMemory.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMLogs } from "./EVMLogs.slb";
import { EVMUtils } from "./EVMUtils.slb";


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
    struct Instruction {
        function(EVM memory) internal pure returns (uint) handler;
        uint stackIn;
        uint stackOut;
        uint gas;
    }
    
    struct EVMInput {
        uint gas;
        uint value;
        bytes data;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        bytes32 logHash;
        Handlers handlers;
        bool staticExec;
        
        EVMMemory.Memory mem;
        EVMStack.Stack stack;
        uint pcStart;
        uint pcEnd;
    }
    
    struct EVMCreateInput {
        uint gas;
        uint value;
        bytes code;
        address caller;
        address target;
        Context context;
        EVMAccounts.Accounts accounts;
        bytes32 logHash;
        Handlers handlers;
    }
    
    struct Handlers {
        Instruction[256] ins;
        function(EVM memory /* input */) internal pure returns (bytes memory /* ret */, uint /* errno */)[9] p;
    }
    
    struct EVM {
        uint gas;
        uint value;
        bytes code;
        bytes data;
        bytes lastRet;
        bytes returnData;
        uint errno;
        uint errpc;
        
        EVMAccounts.Accounts accounts;
        bytes32 logHash;
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

    // Init EVM with given stack and memory and execute from the given opcode
    // intInput[0] - pcStart
    // intInput[1] - pcEnd
    // intInput[2] - block gasLimit
    // intInput[3] - tx gasLimit
    function execute(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) public pure returns (Result memory) {
        // solhint-disable-next-line avoid-low-level-calls
        return flattenResult(
            initAndCall(code, data, intInput, stack, mem, accounts, accountsCode, logHash)
        );
    }

    function initAndCall(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) internal pure returns (EVM memory evm) {
        return _call(
            initInput(code, data, intInput, stack, mem, accounts, accountsCode, logHash),
            CallType.Call
        );
    }
    
    function initInput(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) internal pure returns (EVMInput memory evmInput) {
        evmInput.data = data;
        evmInput.handlers = _newHandlers();
        evmInput.staticExec = false;
        evmInput.caller = DEFAULT_CALLER;
        evmInput.target = DEFAULT_CONTRACT_ADDRESS;
        evmInput.context = Context(
            DEFAULT_CALLER,
            0,
            intInput[2],
            0,
            0,
            0,
            0
        );
        evmInput.gas = intInput[3];
        evmInput.accounts = _accsFromArray(accounts, accountsCode);
        evmInput.logHash = logHash;

        EVMAccounts.Account memory caller = evmInput.accounts.get(DEFAULT_CALLER);
        caller.nonce = uint8(1);

        EVMAccounts.Account memory target = evmInput.accounts.get(DEFAULT_CONTRACT_ADDRESS);
        target.code = code;

        evmInput.pcStart = intInput[0];
        evmInput.pcEnd = intInput[1];
        evmInput.stack = EVMStack.fromArray(stack);
        evmInput.mem = EVMMemory.fromArray(mem);
    }

    function flattenResult(EVM memory evm) internal pure returns (Result memory) {
        Result memory result;
        result.stack = evm.stack.toArray();
        result.mem = evm.mem.toArray();
        result.returnData = evm.returnData;
        result.errno = evm.errno;
        result.errpc = evm.errpc;
        result.pc = evm.pc;
        // TODO handle accounts that result from a failed transaction.
        (result.accounts, result.accountsCode) = evm.accounts.toArray();
        result.gasRemaining = evm.gas;
        result.logHash = evm.logHash;

        return result;
    }

    function _accsFromArray(
        uint[] memory accountsIn,
        bytes memory accountsCode
    ) internal pure returns (EVMAccounts.Accounts memory accountsOut) {
        if (accountsIn.length == 0) {
            return accountsOut;
        }
        uint offset = 0;
        while (offset < accountsIn.length) {
            address addr = address(accountsIn[offset]);
            EVMAccounts.Account memory acc = accountsOut.get(addr);
            acc.balance = accountsIn[offset + 1];
            acc.nonce = uint8(accountsIn[offset + 2]);
            acc.destroyed = accountsIn[offset + 3] == 1;
            uint codeSize = accountsIn[offset + 5];
            acc.code = new bytes(codeSize);
            EVMUtils.copy(accountsCode, acc.code, accountsIn[offset + 4], 0, codeSize); // accountsIn[offset + 4] - code offset
            uint storageSize = accountsIn[offset + 6];
            for (uint i = 0; i < storageSize; i++) {
                acc.stge.store(accountsIn[offset + 7 + 2*i], accountsIn[offset + 8 + 2*i]);
            }
            offset += 7 + 2 * storageSize;
        }
    }

    function _call(EVMInput memory evmInput, CallType callType) internal pure returns (EVM memory evm) {
        evm.context = evmInput.context;
        evm.handlers = evmInput.handlers;
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
            (evm.returnData, evm.errno) = evm.handlers.p[uint(evm.target.addr)](evm);
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
            _run(evm, evmInput.pcStart, evmInput.pcEnd);
        }
    }
    
    function _create(EVMCreateInput memory evmInput) internal pure returns (EVM memory evm, address addr) {
        evm.context = evmInput.context;
        evm.handlers = evmInput.handlers;
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
        newAcc.code = evm.returnData;
        addr = newAddress;
    }

    // solhint-disable-next-line code-complexity, function-max-lines, security/no-assign-params
    function _run(EVM memory evm, uint pc, uint pcEnd) internal pure {

        uint pcNext = 0;
        uint errno = NO_ERROR;
        bytes memory code = evm.code;

        if (evm.gas > evm.context.gasLimit) {
            errno = ERROR_OUT_OF_GAS;
        }

        while (errno == NO_ERROR && pc < code.length && (pcEnd == 0 || pc != pcEnd)) {
            uint8 opcode = uint8(code[pc]);
            Instruction memory ins = evm.handlers.ins[opcode];

            if (ins.gas != GAS_ADDITIONAL_HANDLING) {
                if (ins.gas > evm.gas) {
                    errno = ERROR_OUT_OF_GAS;
                    evm.gas = 0;
                    break;
                }
                evm.gas -= ins.gas;
            }

            // Check for violation of static execution.
            if (
                evm.staticExec && 
                (opcode == OP_SSTORE || opcode == OP_CREATE || (OP_LOG0 <= opcode && opcode <= OP_LOG4))
            ) {
                errno = ERROR_ILLEGAL_WRITE_OPERATION;
                break;
            }

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
    function handlePreC_ECRECOVER(EVM memory state) internal pure returns (bytes memory ret, uint errno) {
        if (GAS_ECRECOVER > state.gas) {
            state.gas = 0;
            return (ret, ERROR_OUT_OF_GAS);
        }
        state.gas -= GAS_ECRECOVER;

        uint hash = state.data.length < 32 ? 0: EVMUtils.toUint(state.data, 0, 32);
        uint v = state.data.length < 64 ? 0 : uint8(EVMUtils.toUint(state.data, 32, 32));
        uint r = state.data.length < 96 ? 0 : EVMUtils.toUint(state.data, 64, 32);
        uint s = state.data.length < 128 ? 0 : EVMUtils.toUint(state.data, 96, 32);
        address result = ecrecover(bytes32(hash), uint8(v), bytes32(r), bytes32(s));
        ret = EVMUtils.fromUint(uint(result));
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_SHA256(EVM memory state) internal pure returns (bytes memory ret, uint errno) {
        uint gasFee = GAS_SHA256_BASE + (((state.data.length + 31) / 32) * GAS_SHA256_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            return (ret, ERROR_OUT_OF_GAS);
        }
        state.gas -= gasFee;

        bytes32 result = sha256(state.data);
        ret = EVMUtils.fromUint(uint(result));
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_RIPEMD160(EVM memory state) internal pure returns (bytes memory ret, uint errno) {
        uint gasFee = GAS_RIPEMD160_BASE + (((state.data.length + 31) / 32) * GAS_RIPEMD160_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            return (ret, ERROR_OUT_OF_GAS);
        }
        state.gas -= gasFee;

        bytes20 result = ripemd160(state.data);
        ret = EVMUtils.fromUint(uint(bytes32(result)));
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_IDENTITY(EVM memory state) internal pure returns (bytes memory ret, uint errno) {
        uint gasFee = GAS_IDENTITY_BASE + (((state.data.length + 31) / 32) * GAS_IDENTITY_WORD);

        if (gasFee > state.gas) {
            state.gas = 0;
            return (ret, ERROR_OUT_OF_GAS);
        }
        state.gas -= gasFee;

        ret = state.data;
    }
    
    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_MODEXP(EVM memory) internal pure returns (bytes memory, uint errno) {
        // TODO
        errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECADD(EVM memory) internal pure returns (bytes memory, uint errno) {
        // TODO
        errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECMUL(EVM memory) internal pure returns (bytes memory, uint errno) {
        // TODO
        errno = ERROR_PRECOMPILE_NOT_IMPLEMENTED;
    }

    // solhint-disable-next-line func-name-mixedcase
    function handlePreC_ECPAIRING(EVM memory) internal pure returns (bytes memory, uint errno) {
        // TODO
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
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= c;

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
        uint res = GAS_SHA3 +
            (((n + 31) / 32) * GAS_SHA3WORD) +
            computeGasForMemory(state, p + n);

        if (res > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= res;

        uint mp = state.mem.memUPtr(p);

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
        state.stack.push(state.accounts.get(address(state.stack.pop())).balance);
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

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.mem.storeBytesAndPadWithZeroes(
            state.data,
            dAddr,
            mAddr,
            len
        );
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

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.mem.storeBytes(state.code, cAddr, mAddr, len);
    }
    
    function handleGASPRICE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.context.gasPrice);
    }
    
    function handleEXTCODESIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.accounts.get(address(state.stack.pop())).code.length);
    }
    
    function handleEXTCODECOPY(EVM memory state) internal pure returns (uint) {
        bytes memory code = state.accounts.get(address(state.stack.pop())).code;
        uint mAddr = state.stack.pop();
        uint dAddr = state.stack.pop();
        uint len = state.stack.pop();

        if (dAddr + len > code.length) {
            return ERROR_INDEX_OOB;
        }

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.mem.storeBytes(code, dAddr, mAddr, len);
    }
    
    function handleRETURNDATASIZE(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.lastRet.length);
    }
    
    function handleRETURNDATACOPY(EVM memory state) internal pure returns (uint) {
        uint mAddr = state.stack.pop();
        uint rAddr = state.stack.pop();
        uint len = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemoryCopy(state, mAddr, len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
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
        state.stack.push(state.mem.load(state.stack.pop()));
    }
    
    function handleMSTORE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();

        uint gasFee = GAS_VERYLOW + computeGasForMemory(state, addr + 32);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.mem.store(addr, val);
    }
    
    function handleMSTORE8(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint8 val = uint8(state.stack.pop());

        uint gasFee = GAS_VERYLOW + computeGasForMemory(state, addr + 1);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.mem.store8(addr, val);
    }
    
    function handleSLOAD(EVM memory state) internal pure returns (uint) {
        state.stack.push(state.target.stge.load(state.stack.pop()));
    }
    
    function handleSSTORE(EVM memory state) internal pure returns (uint) {
        uint addr = state.stack.pop();
        uint val = state.stack.pop();

        uint gasFee = GAS_SSET;
        if (val == 0) {
            gasFee = GAS_SRESET;
        }

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }

        state.gas -= gasFee;

        state.target.stge.store(addr, val);
    }
    
    function handleJUMP(EVM memory state) internal pure returns (uint) {
        uint dest = state.stack.pop();
        if (dest >= state.code.length || uint8(state.code[dest]) != OP_JUMPDEST) {
            return ERROR_INVALID_JUMP_DESTINATION;
        }
        state.pc = dest;
    }
    
    function handleJUMPI(EVM memory state) internal pure returns (uint) {
        uint dest = state.stack.pop();
        uint cnd = state.stack.pop();
        if (cnd == 0) {
            state.pc = state.pc + 1;
            return 0;
        }
        if (dest >= state.code.length || uint8(state.code[dest]) != OP_JUMPDEST) {
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
        uint mAddr = state.stack.pop();
        uint mSize = state.stack.pop();
        uint gasFee = GAS_LOG +
            (GAS_LOGTOPIC * state.n) +
            (mSize * GAS_LOGDATA) +
            computeGasForMemory(state, mAddr + mSize);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
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
    function handleCREATE(EVM memory state) internal pure returns (uint) {
        assert(!state.staticExec);

        EVMCreateInput memory input;
        input.gas = state.gas;
        input.value = state.stack.pop();

        uint memOffset = state.stack.pop();
        uint memSize = state.stack.pop();
        uint gasFee = GAS_CREATE + computeGasForMemory(state, memOffset + memSize);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        input.gas -= gasFee;

        input.code = state.mem.toArray(memOffset, memSize);
        input.caller = state.target.addr;
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
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
            state.logHash = retEvm.logHash;
        }
        state.gas = retEvm.gas;
    }
    
    function handleCREATE2(EVM memory) internal pure returns (uint) {
        return ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
    
    function handleCALL(EVM memory state) internal pure returns (uint) {
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

        if (input.gas + gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= gasFee;

        input.data = state.mem.toArray(inOffset, inSize);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.handlers = state.handlers;
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
    
    function handleCALLCODE(EVM memory) internal pure returns (uint) {
        return ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
    
    function handleRETURN(EVM memory state) internal pure returns (uint) {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toArray(start, len);
    }
    
    function handleDELEGATECALL(EVM memory state) internal pure returns (uint) {
        EVMInput memory input;

        input.gas = state.stack.pop();
        bytes memory oldCode = state.target.code;
        state.target.code = state.accounts.get(address(state.stack.pop())).code;
        input.target = state.target.addr;

        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();

        uint gasFee = GAS_CALL +
            computeGasForMemory(state, retOffset + retSize, inOffset + inSize);

        if (input.gas + gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= gasFee;

        input.data = state.mem.toArray(inOffset, inSize);
        input.value = state.value;
        input.caller = state.caller.addr;
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.handlers = state.handlers;
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
    
    function handleSTATICCALL(EVM memory state) internal pure returns (uint) {
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

        if (input.gas + gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= gasFee;

        input.data = state.mem.toArray(inOffset, inSize);
        input.context = state.context;
        input.accounts = state.accounts;
        input.logHash = state.logHash;
        input.handlers = state.handlers;
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
    
    function handleREVERT(EVM memory state) internal pure returns (uint) {
        uint start = state.stack.pop();
        uint len = state.stack.pop();
        uint gasFee = computeGasForMemory(state, start + len);

        if (gasFee > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= gasFee;

        state.returnData = state.mem.toArray(start, len);
        return ERROR_STATE_REVERTED;
    }
    
    function handleINVALID(EVM memory) internal pure returns (uint) {
        return ERROR_INVALID_OPCODE;
    }
    
    function handleSELFDESTRUCT(EVM memory state) internal pure returns (uint) {
        // receiver
        EVMAccounts.Account memory acc = state.accounts.get(address(state.stack.pop()));

        if (GAS_SELFDESTRUCT > state.gas) {
            state.gas = 0;
            return ERROR_OUT_OF_GAS;
        }
        state.gas -= GAS_SELFDESTRUCT;

        if (state.target.balance > 0) {
            if (acc.nonce == 0) {
                // assuming new account created!?
                if (GAS_NEWACCOUNT > state.gas) {
                    state.gas = 0;
                    return ERROR_OUT_OF_GAS;
                }
                state.gas -= GAS_NEWACCOUNT;
            }

            acc.balance += state.target.balance;
            state.target.balance = 0;
        }

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
            Instruction(handleEXP, 2, 1, GAS_ADDITIONAL_HANDLING),
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
            Instruction(handleSHA3, 2, 1, GAS_ADDITIONAL_HANDLING),
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
            Instruction(handleCALLDATACOPY, 3, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleCODESIZE, 0, 1, GAS_BASE),
            Instruction(handleCODECOPY, 3, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleGASPRICE, 0, 1, GAS_BASE),
            Instruction(handleEXTCODESIZE, 1, 1, GAS_EXTCODE),
            Instruction(handleEXTCODECOPY, 4, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleRETURNDATASIZE, 0, 1, GAS_BASE),
            Instruction(handleRETURNDATACOPY, 3, 0, GAS_ADDITIONAL_HANDLING),
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
            Instruction(handleMSTORE, 2, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleMSTORE8, 2, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleSLOAD, 1, 1, GAS_SLOAD),
            Instruction(handleSSTORE, 2, 0, GAS_ADDITIONAL_HANDLING),
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
            Instruction(handleLOG, 2, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleLOG, 3, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleLOG, 4, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleLOG, 5, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleLOG, 6, 0, GAS_ADDITIONAL_HANDLING),
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
            Instruction(handleCREATE, 3, 1, GAS_ADDITIONAL_HANDLING),
            Instruction(handleCALL, 7, 1, GAS_ADDITIONAL_HANDLING),
            Instruction(handleCALLCODE, 7, 1, GAS_ADDITIONAL_HANDLING),
            Instruction(handleRETURN, 2, 0, GAS_ADDITIONAL_HANDLING),
            Instruction(handleDELEGATECALL, 6, 1, GAS_ADDITIONAL_HANDLING),
            inv,
            inv,
            inv,
            inv,
            inv,
            Instruction(handleSTATICCALL, 6, 1, GAS_ADDITIONAL_HANDLING),
            inv,
            inv,
            Instruction(handleREVERT, 2, 0, GAS_ADDITIONAL_HANDLING),
            inv,
            Instruction(handleSELFDESTRUCT, 1, 0, GAS_ADDITIONAL_HANDLING)
        ];
        
        handlers.p[1] = handlePreC_ECRECOVER;
        handlers.p[2] = handlePreC_SHA256;
        handlers.p[3] = handlePreC_RIPEMD160;
        handlers.p[4] = handlePreC_IDENTITY;
        handlers.p[5] = handlePreC_MODEXP;
        handlers.p[6] = handlePreC_ECADD;
        handlers.p[7] = handlePreC_ECMUL;
        handlers.p[8] = handlePreC_ECPAIRING;
    }

    function concat(bytes memory _preBytes, bytes memory _postBytes) internal pure returns (bytes memory) {
        bytes memory tempBytes;

        assembly {
            // Get a location of some free memory and store it in tempBytes as
            // Solidity does for memory variables.
            tempBytes := mload(0x40)

            // Store the length of the first bytes array at the beginning of
            // the memory for tempBytes.
            let length := mload(_preBytes)
            mstore(tempBytes, length)

            // Maintain a memory counter for the current write location in the
            // temp bytes array by adding the 32 bytes for the array length to
            // the starting location.
            let mc := add(tempBytes, 0x20)
            // Stop copying when the memory counter reaches the length of the
            // first bytes array.
            let end := add(mc, length)

            for {
                // Initialize a copy counter to the start of the _preBytes data,
                // 32 bytes into its memory.
                let cc := add(_preBytes, 0x20)
            } lt(mc, end) {
                // Increase both counters by 32 bytes each iteration.
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                // Write the _preBytes data into the tempBytes memory 32 bytes
                // at a time.
                mstore(mc, mload(cc))
            }

            // Add the length of _postBytes to the current length of tempBytes
            // and store it as the new length in the first 32 bytes of the
            // tempBytes memory.
            length := mload(_postBytes)
            mstore(tempBytes, add(length, mload(tempBytes)))

            // Move the memory counter back from a multiple of 0x20 to the
            // actual end of the _preBytes data.
            mc := end
            // Stop copying when the memory counter reaches the new combined
            // length of the arrays.
            end := add(mc, length)

            for {
                let cc := add(_postBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            // Update the free-memory pointer by padding our last write location
            // to 32 bytes: add 31 bytes to the end of tempBytes to move to the
            // next 32 byte block, then round down to the nearest multiple of
            // 32. If the sum of the length of the two arrays is zero then add 
            // one before rounding down to leave a blank 32 bytes (the length block with 0).
            mstore(0x40, and(
              add(add(end, iszero(add(length, mload(_preBytes)))), 31),
              not(31) // Round down to the nearest 32 bytes.
            ))
        }

        return tempBytes;
    }
    
}
