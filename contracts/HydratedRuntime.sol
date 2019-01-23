pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


import "./EVMCode.slb";
import "./EVMStack.slb";
import "./EVMMemory.slb";
import "./EVMAccounts.slb";
import "./EVMLogs.slb";
import "./EVMRuntime.sol";


contract HydratedRuntime is EVMRuntime {

    struct HydratedState {
        bytes32 stackHash;
        bytes32 memHash;
        bytes32 logHash;
    }

    function initHydratedState(EVM memory evm) internal pure returns (HydratedState memory hydratedState) {
        uint ptr;

        assembly {
            ptr := hydratedState
        }

        evm.customDataPtr = ptr;
    }

    function getHydratedState(EVM memory evm) internal pure returns (HydratedState memory) {
        HydratedState memory res;
        uint ptr = evm.customDataPtr;

        assembly {
            res := ptr
        }

        return res;
    }

    function _run(EVM memory evm, uint pc, uint pcStepCount) internal {
        super._run(evm, pc, pcStepCount);

        // TODO:
        // gather all proofs here
        // How we compute the proofs below is not final yet.
        // Update memory proofs setup to use slot, value, once OffchainStepper support lands.
        HydratedState memory hydratedState = getHydratedState(evm);

        bytes32 hash = hydratedState.stackHash;
        uint ptr = evm.stack.dataPtr;

        for (uint i = 0; i < evm.stack.size; i++) {
            assembly {
                mstore(0, hash)
                mstore(0x20, mload(add(ptr, mul(i, 0x20))))
                hash := keccak256(0, 0x40)
            }
        }
        hydratedState.stackHash = hash;

        bytes memory mem = evm.mem.toArray();
        if (mem.length > 0) {
            hydratedState.memHash = keccak256(abi.encodePacked(evm.mem.toArray()));
        }
    }

    function handleLOG(EVM memory state) internal {
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

        HydratedState memory hydratedState = getHydratedState(state);

        hydratedState.logHash = keccak256(
            abi.encodePacked(
                hydratedState.logHash,
                log.account,
                log.topics,
                log.data
            )
        );
    }
}
