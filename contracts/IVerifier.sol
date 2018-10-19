pragma solidity ^0.4.18;

contract IVerifier {

	function initGame(bytes32 _executionId, bytes32 _endHash, address _solver, address _challenger) public;
}
