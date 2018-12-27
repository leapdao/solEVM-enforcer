pragma solidity 0.4.25;


contract Migrations {
    address public owner;
    // solhint-disable-next-line var-name-mixedcase
    uint public last_completed_migration;

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function setCompleted(uint completed) public restricted {
        last_completed_migration = completed;
    }

    // solhint-disable-next-line func-param-name-mixedcase
    function upgrade(address new_address) public restricted {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
