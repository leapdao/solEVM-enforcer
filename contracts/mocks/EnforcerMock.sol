pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../Enforcer.sol";


contract EnforcerMock is Enforcer {
    constructor(
        address _verifier,
        uint256 _taskPeriod,
        uint256 _challengePeriod,
        uint256 _bondAmount,
        uint256 _maxExecutionDepth
    ) public Enforcer(_verifier, _taskPeriod, _challengePeriod, _bondAmount, _maxExecutionDepth) {}

    function remove(bytes32 taskHash, bytes32 solverPathRoot) public {
        bytes32 executionId = keccak256(abi.encodePacked(taskHash, solverPathRoot));
        executions[executionId].startBlock = 0;
    }
}
