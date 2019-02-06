pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import { EVMCode } from "./EVMCode.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMMemory } from "./EVMMemory.slb";
import { EVMAccounts } from "./EVMAccounts.slb";
import { HydratedRuntime } from "./HydratedRuntime.sol";


contract EthereumRuntime is HydratedRuntime {

    struct EVMPreimage {
        address code;
        bytes data;
        uint gasLimit;
        uint pc;
        uint8 errno;
        uint gasRemaining;
        uint stepCount;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        bytes returnData;
        bytes32 logHash;
    }

    struct EVMResult {
        uint gas;
        bytes data;
        bytes lastRet;
        bytes returnData;
        uint8 errno;
        uint[] accounts;
        bytes accountsCode;
        bytes mem;
        uint[] stack;
        uint16 depth;
        // uint n;
        uint pc;
        bytes32 logHash;
        bytes32 hashValue;
    }

    // Init EVM with given stack and memory and execute from the given opcode
    // solhint-disable-next-line function-max-lines
    function execute(EVMPreimage memory img) public returns (EVMResult memory) {
        // solhint-disable-next-line avoid-low-level-calls
        EVM memory evm;

        HydratedState memory hydratedState = initHydratedState(evm);
        hydratedState.logHash = img.logHash;

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
        resultState.data = evm.data;
        resultState.lastRet = evm.lastRet;
        resultState.returnData = evm.returnData;
        resultState.errno = evm.errno;
        (resultState.accounts, resultState.accountsCode) = evm.accounts.toArray();
        resultState.logHash = hydratedState.logHash;
        resultState.mem = EVMMemory.toArray(evm.mem);
        resultState.stack = EVMStack.toArray(evm.stack);
        resultState.depth = evm.depth;
        resultState.pc = evm.pc;
        resultState.hashValue = hashValue;

        return resultState;
    }

    function stateHash(EVM memory evm, Context memory context) internal view returns (bytes32) {
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
            evm.code.toBytes(),
            evm.data,
            evm.lastRet,
            evm.returnData,
            evm.errno,
            evm.accounts.size
        ));

        HydratedState memory hydratedState = getHydratedState(evm);

        bytes32 hashValue = keccak256(abi.encodePacked(
            dataHash,
            hydratedState.logHash,
            evm.mem.size,
            evm.stack.size,
            evm.depth,
            evm.pc,
            contextHash
        ));

        return hashValue;
    }
}
