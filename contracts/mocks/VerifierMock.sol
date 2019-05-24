pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../Enforcer.sol";


contract VerifierMock {
    Enforcer enforcer;
    uint256 public timeoutDuration;

    constructor(uint256 timeout) public {
        timeoutDuration = timeout;
    }

    function setEnforcer(address _enforcer) public {
        enforcer = Enforcer(_enforcer);
    }

    function initGame(
        bytes32 executionId,
        bytes32 solverHashRoot,
        bytes32 challengerHashRoot,
        uint256 treeDepth,
        address challenger,
        address codeContractAddress,
        bytes memory callData
    ) public returns (bytes32 disputeId) {
        // do nothing
    }

    function submitResult(bytes32 executionId, bool solverWon, address challenger) public {
        enforcer.result(executionId, solverWon, challenger);
    }

    function dummy() public {}
}

