pragma solidity 0.4.24;

import "./IEnforcer.sol";
import "./IVerifier.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract SampleVerifier is Ownable {

    address public owner;
    uint256 public timeoutDuration;

    IEnforcer public enforcer;

    constructor(uint256 _timeout) public {
        owner = msg.sender;
        timeoutDuration = _timeout;
    }

    function setEnforcer(address _enforcer) public onlyOwner() {
        enforcer = IEnforcer(_enforcer);
    }

    modifier onlyEnforcer() {
        require(msg.sender == address(enforcer), "only enforcer");
        _;
    }
}
