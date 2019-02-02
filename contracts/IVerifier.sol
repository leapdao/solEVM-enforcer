pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


contract IVerifier {
    function initGame(bytes32 _executionId,
        bytes32 _solverHashRoot,
        uint256 _solverStep,
        bytes32 _challengerHashRoot,
        uint256 _challengerStep,
        address _challenger) public;
}
