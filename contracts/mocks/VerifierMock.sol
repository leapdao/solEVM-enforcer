pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../Enforcer.sol";


contract VerifierMock {
    Enforcer enforcer;
    constructor() public {}

    function setEnforcer(address _enforcer) public {
        enforcer = Enforcer(_enforcer);
    }

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

    function submitResult(bytes32 executionId, bool solverWon, address challenger) public {
        enforcer.result(executionId, solverWon, challenger);
    }

    function dummy() public {}
}

