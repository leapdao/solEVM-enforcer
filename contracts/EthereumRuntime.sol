pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import { EVMCode } from "./EVMCode.slb";
import { EVMStack } from "./EVMStack.slb";
import { EVMMemory } from "./EVMMemory.slb";
import { HydratedRuntime } from "./HydratedRuntime.sol";


contract EthereumRuntime is HydratedRuntime {

    struct EVMPreimage {
        address code;
        bytes data;
        uint pc;
        uint8 errno;
        uint gasRemaining;
        uint stepCount;
        bytes32[] stack;
        bytes32[] mem;
        bytes returnData;
    }

    struct EVMResult {
        uint gas;
        bytes data;
        bytes returnData;
        uint8 errno;
        bytes32[] mem;
        bytes32[] stack;
        uint pc;
        bytes32 hashValue;
    }

    // Init EVM with given stack and memory and execute from the given opcode
    // solhint-disable-next-line function-max-lines
    function execute(EVMPreimage memory img) public returns (EVMResult memory) {
        // solhint-disable-next-line avoid-low-level-calls
        EVM memory evm;

        initHydratedState(evm);

        evm.data = img.data;
        evm.gas = img.gasRemaining;

        evm.caller = DEFAULT_CALLER;
        evm.target = DEFAULT_CONTRACT_ADDRESS;
        evm.returnData = img.returnData;
        evm.errno = img.errno;

        evm.code = EVMCode.fromAddress(img.code);
        evm.stack = EVMStack.fromArray(img.stack);
        evm.mem = EVMMemory.fromArray(img.mem);

        _run(evm, img.pc, img.stepCount);

        bytes32 hashValue = stateHash(evm);
        EVMResult memory resultState;

        resultState.gas = evm.gas;
        resultState.data = evm.data;
        resultState.returnData = evm.returnData;
        resultState.errno = evm.errno;
        resultState.mem = EVMMemory.toArray(evm.mem);
        resultState.stack = EVMStack.toArray(evm.stack);
        resultState.pc = evm.pc;
        resultState.hashValue = hashValue;

        return resultState;
    }

    function stateHash(EVM memory evm) internal view returns (bytes32) {
        bytes32 dataHash = keccak256(abi.encodePacked(
            evm.gas,
            evm.code.toBytes(0, evm.code.length),
            evm.data,
            evm.returnData,
            evm.errno
        ));

        HydratedState memory hydratedState = getHydratedState(evm);

        bytes32 hashValue = keccak256(abi.encodePacked(
            dataHash,
            hydratedState.stackHash,
            hydratedState.memHash,
            evm.mem.size,
            evm.stack.size,
            evm.pc,
            evm.caller,
            evm.target,
            evm.blockNumber,
            evm.blockTime,
            evm.blockHash
        ));

        return hashValue;
    }
}
