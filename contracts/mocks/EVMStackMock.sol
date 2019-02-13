pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../EVMStack.slb";
import "../MemOps.slb";


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

    function testCreate() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        uint fPtr = MemOps.freeMemPtr();

        require(stack.dataPtr == (fPtr - (stack.cap * 32)), "staack.dataPtr");
        require(stack.size == 0, "stack.size");
        require(stack.cap == 64, "stack.cap");
    }

    function testPush() public {
        uint DATA = 1234;
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(DATA);
        uint val;
        uint pos = stack.dataPtr;
        assembly {
            val := mload(pos)
        }
        require(val == DATA, "val == DATA");
        require(stack.size == 1, "stack.size");
        require(stack.cap == 64, "stack.cap");
    }

    function testPop() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        uint data = stack.pop();
        require(stack.size == 0, "stack.size");
        require(data == 1, "data");
        uint dataA;
        uint slot = stack.dataPtr;
        assembly {
            dataA := mload(slot)
        }
        require(dataA == 0, "dataA");
    }

    function testDup1() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.dup(1);
        require(stack.size == 2, "stack.size");
        require(stack.pop() == 1, "pop 1");
        require(stack.pop() == 1, "pop 2");
    }

    function testDup16() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        for (uint i = 0; i < 16; i++) {
            stack.push(i + 1);
        }
        stack.dup(16);
        require(stack.size == 17, "stack.size");
        require(stack.pop() == 1, "stack.pop");
        for (uint i = 0; i < 16; i++) {
            require(stack.pop() == (16 - i), "stack.pop loop");
        }
    }

    function testSwap1() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        for (uint i = 0; i < 17; i++) {
            stack.push(i + 1);
        }
        stack.swap(16);
        require(stack.size == 17, "stack.size");
        require(stack.pop() == 1, "stack.pop");

        for (uint i = 0; i < 15; i++) {
            stack.pop();
        }
        require(stack.pop() == 17, "stack.pop 2");
    }

    function testSwap16() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.push(2);
        stack.swap(1);
        require(stack.size == 2, "stack.size 2");
        require(stack.pop() == 1, "pop 1");
        require(stack.pop() == 2, "pop 2");
    }
}
