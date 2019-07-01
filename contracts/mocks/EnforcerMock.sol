pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../Enforcer.sol";


contract EnforcerMock is Enforcer {
    constructor(address _verifier, uint256 _challengePeriod, uint256 _bondAmount, uint256 _maxExecutionDepth) public
        Enforcer(_verifier, _challengePeriod, _bondAmount, _maxExecutionDepth) {}

    function remove(bytes32 codeHashRoot, bytes memory _callData) public {
        bytes32 executionId = keccak256(abi.encodePacked(codeHashRoot, _callData));
        executions[executionId].startBlock = 0;
    }
}
