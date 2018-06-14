pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;
pragma solidity ^0.4.22;

import {EVMStack} from "../EVMStack.slb";

contract EVMStackMock {
    using EVMStack for EVMStack.Stack;

    function dupThrowsNTooSmall() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(0);
    }

    function dupThrowsNTooLarge() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(17);
    }

    function dupThrowsUnderflow() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(1);
    }

    function popThrowsUnderflow() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.pop();
    }

    function pushThrowsOverflow() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.size = 1024;
        stack.push(1);
    }

    function dupThrowsOverflow() public pure {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.size = 1024;
        stack.dup(1);
    }

}