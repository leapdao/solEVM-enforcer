pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import {EVMStack} from "../EVMStack.slb";


contract EVMStackMock {
    using EVMStack for EVMStack.Stack;

    function dupThrowsNTooSmall() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(0);
    }

    function dupThrowsNTooLarge() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(17);
    }

    function dupThrowsUnderflow() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.dup(1);
    }

    function popThrowsUnderflow() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.pop();
    }

    function pushThrowsOverflow() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.size = 1024;
        stack.push(1);
    }

    function dupThrowsOverflow() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.size = 1024;
        stack.dup(1);
    }
}
