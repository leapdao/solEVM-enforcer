pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


contract IVerifier {

    function initGame(bytes32 _executionId, bytes32 _endHash, address _solver, address _challenger) public;
}
