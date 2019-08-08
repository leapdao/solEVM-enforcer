pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";


contract IVerifier {
    struct ComputationPath {
        bytes32 left;
        bytes32 right;
    }

    // 256x32 bytes as the memory limit
    uint constant internal MAX_MEM_WORD_COUNT = 256;

    uint8 constant internal SOLVER_RESPONDED = 1 << 0;
    uint8 constant internal CHALLENGER_RESPONDED = 1 << 1;
    uint8 constant internal SOLVER_VERIFIED = 1 << 2;
    uint8 constant internal CHALLENGER_VERIFIED = 1 << 3;
    uint8 constant internal START_OF_EXECUTION = 1 << 4;
    uint8 constant internal END_OF_EXECUTION = 1 << 5;
    uint8 constant internal INITIAL_STATE = START_OF_EXECUTION | END_OF_EXECUTION;

    struct Dispute {
        bytes32 executionId;
        bytes32 initialStateHash;
        bytes32 codeHash;
        address challengerAddr;

        bytes32 solverPath;
        bytes32 challengerPath;
        uint256 treeDepth;
        bytes32 witness;

        ComputationPath solver;
        ComputationPath challenger;

        uint8 state;

        uint256 timeout; // in seconds
    }

    event DisputeNewRound(bytes32 indexed disputeId, uint256 timeout, bytes32 solverPath, bytes32 challengerPath);

    uint256 public timeoutDuration;

    IEnforcer public enforcer;

    mapping (bytes32 => Dispute) public disputes;

    function initGame(
        bytes32 executionId,
        bytes32 solverHashRoot,
        bytes32 challengerHashRoot,
        uint256 executionDepth,
        // optional for implementors
        bytes32 customEnvironmentHash,
        // TODO: should be the bytes32 root hash later on
        bytes32 codeHash,
        bytes32 dataHash,
        address challenger
    ) public returns (bytes32 disputeId);
}
