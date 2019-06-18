pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


contract IEnforcer {
    /*
     * @dev Structure for the v-game EVM environment.
     */
    struct EVMParameters {
        // Transaction sender
        address origin;
        // address of the current contract / execution context
        address target;
        // blockHash
        bytes32 blockHash;
        // blockNumber
        uint256 blockNumber;
        // timestamp of the current block in seconds since the epoch
        uint256 time;
        // tx gas limit
        uint256 txGasLimit;
        // customEnvironmentHash - for custom implementations like Plasma Exit
        bytes32 customEnvironmentHash;
        // codeHash / dataHash should be the root hash of the given merkle tree
        // Except that codeHash could also be the contract address (needs clarification)
        bytes32 codeHash;
        bytes32 dataHash;
    }

    struct ExecutionResult {
        uint256 startBlock;
        bytes32 endHash;
        uint256 executionDepth;
        bytes32 resultHash;
        address solver;
    }

    event Request(bytes32 indexed executionId, EVMParameters parameters);

    event Registered(
        bytes32 indexed executionId,
        address indexed solver,
        bytes32 executionResultId,
        bytes32 endHash,
        uint256 executionDepth,
        bytes32 resultHash
    );

    event DisputeInitialised(bytes32 indexed disputeId, bytes32 indexed executionId);
    event Slashed(bytes32 indexed executionId, address indexed _address);

    function parameterHash(EVMParameters memory _parameters) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _parameters.codeHash,
                _parameters.dataHash
            )
        );
    }
}
