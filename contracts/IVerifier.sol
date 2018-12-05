pragma solidity ^0.4.18;
pragma experimental ABIEncoderV2;


library CompactExecution {
    struct StateHash {
        bytes32 hash;
        uint256 step;
    }

    struct ComputationHash {
        bytes32 merkleRoot;
        uint256 stepCount;
    }
}


contract IVerifier {
    function initGame(bytes32 _executionId,
        bytes32 _solverHashRoot,
        uint256 _solverStep,
        bytes32 _challengerHashRoot,
        uint256 _challengerStep,
        address _solver, address _challenger) public;
}
