pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

contract IEnforcer {

  function result(bytes32 _executionId, bool _result, address _challenger) public;

  function register(bytes memory _code, bytes memory _callData, bytes32 _endHash) payable public;
}
