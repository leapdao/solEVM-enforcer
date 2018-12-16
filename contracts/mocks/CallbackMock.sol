pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "../IEnforcer.sol";


contract CallbackMock {

    event Finalize(bytes32 indexed _computationId);

    // solhint-disable-next-line no-simple-event-func-name
    function finalize(bytes32 _computationId) public payable {
        emit Finalize(_computationId);
    }

    // register a new execution
    function register(address _enforcer, bytes memory _code, bytes memory _callData, bytes32 _endHash, uint256 _step) public payable {
        IEnforcer enforcer = IEnforcer(_enforcer);
        enforcer.register.value(msg.value)(_code, _callData, _endHash, _step);
    }
}
