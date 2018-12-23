pragma solidity ^0.4.24;
import "../IEnforcer.sol";


// Dummy contract to test verifier
contract EnforcerMock is IEnforcer {
    // solhint-disable-next-line no-empty-blocks
    constructor() public {}

    function result(bytes32 _executionId, bool _result, address _challenger) public {
        _executionId;
        _result;
        _challenger;
    }

    function register(bytes _code, bytes _callData, bytes32 _endHash) public payable {
        _code;
        _callData;
        _endHash;
    }
}
