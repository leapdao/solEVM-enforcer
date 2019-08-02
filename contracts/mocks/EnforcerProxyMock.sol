pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./../interfaces/IEnforcer.sol";

contract EnforcerProxyMock {
    IEnforcer enforcer;

    event StatusEvent(uint256, bytes32[], bytes32[]);

    constructor(address _enforcer) public {
        enforcer = IEnforcer(_enforcer);
    }

    function getStatus(bytes32 _taskHash) public {
        (uint256 a, bytes32[] memory b, bytes32[] memory c) = enforcer.getStatus(_taskHash);
        emit StatusEvent(a, b, c);
    }
}
