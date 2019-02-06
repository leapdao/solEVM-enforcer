pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../Enforcer.sol";


contract VerifierMock {
    Enforcer public enforcer;

    struct Dispute {
        bytes32 executionId;
        address challenger;
    }

    mapping(bytes32 => Dispute) public disputes;

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
        disputeId = keccak256(
            abi.encodePacked(
                executionId,
                initialStateHash,
                solverHashRoot,
                solverExecutionLength,
                challengerHashRoot
            )
        );

        disputes[disputeId] = Dispute(executionId, challenger);
    }

    function result(bytes32 disputeId, bool winner) public {
        enforcer.result(disputes[disputeId].executionId, winner, disputes[disputeId].challenger);
    }
}
