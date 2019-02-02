pragma solidity ^0.5.2;
import "../IEnforcer.sol";


// Dummy contract to test verifier
contract EnforcerMock is IEnforcer {
    // solhint-disable-next-line no-empty-blocks
    constructor() public {}

    // solhint-disable-next-line no-unused-vars, no-empty-blocks
    function result(bytes32 _executionId, bool _result, address _challenger) public {}

    // solhint-disable-next-line no-unused-vars, no-empty-blocks
    function register(bytes memory _code, bytes memory _callData, bytes32 _endHash, uint256 _executionLength) public payable {}
}
