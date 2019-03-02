pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


contract VerifierMock {
    constructor() public {}

    function initGame(
        bytes32 executionId,
        bytes32 initialStateHash,
        bytes32 solverHashRoot,
        uint256 solverExecutionLength,
        bytes32 challengerHashRoot,
        address challenger,
        address codeContractAddress
    ) public returns (bytes32 disputeId) {
        // do nothing
    }

    function dummy() public {}
}

