pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "../IEnforcer.sol";

contract CallbackMock {

  event Finalize(bytes32 indexed _computationId);

  function finalize(bytes32 _computationId) payable public {
    emit Finalize(_computationId);
  }

  // register a new execution 
  function register(address _enforcer, bytes memory _code, bytes memory _callData, bytes32 _endHash) payable public {
    IEnforcer enforcer = IEnforcer(_enforcer);
    enforcer.register.value(msg.value)(_code, _callData, _endHash);
  }
}
