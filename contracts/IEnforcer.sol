pragma solidity ^0.4.24;

contract IEnforcer {

  function result(bytes32 _executionId, bool _result, address _challenger) public;

  function register(bytes _code, bytes _callData, bytes32 _endHash) payable public;
}
