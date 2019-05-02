pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./EVMRuntime.sol";


contract HydratedRuntime is EVMRuntime {

    struct HydratedState {
        bytes32 stackHash;
        bytes32 memHash;
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

    function updateHydratedState(EVM memory evm) internal pure {
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
            hydratedState.memHash = keccak256(abi.encodePacked(mem));
        }
    }

    function _run(EVM memory evm, uint pc, uint pcStepCount) internal {
        super._run(evm, pc, pcStepCount);
        updateHydratedState(evm);
    }
}
