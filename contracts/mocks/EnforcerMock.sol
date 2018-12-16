pragma solidity 0.5.2;
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

    function register(bytes memory _code, bytes memory _callData, bytes32 _endHash, uint256 _step) public payable {
        _code;
        _callData;
        _endHash;
        _step;
    }
}
