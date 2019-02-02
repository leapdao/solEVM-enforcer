pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import "truffle/Assert.sol";
import {EVMStack} from "../contracts/EVMStack.slb";
import {MemOps} from "../contracts/MemOps.slb";


contract TestEVMStack {
    using EVMStack for EVMStack.Stack;

    uint constant internal testVal1 = 55;
    uint constant internal testVal2 = 3246;
    uint constant internal testVal3 = 2;

    function testCreate() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        uint fPtr = MemOps.freeMemPtr();

        Assert.equal(stack.dataPtr, fPtr - (stack.cap * 32), "");
        Assert.equal(stack.size, 0, "");
        Assert.equal(stack.cap, 64, "");
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
        Assert.equal(val, DATA, "");
        Assert.equal(stack.size, 1, "");
        Assert.equal(stack.cap, 64, "");
    }

    function testPop() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        uint data = stack.pop();
        Assert.equal(stack.size, 0, "");
        Assert.equal(data, 1, "");
        uint dataA;
        uint slot = stack.dataPtr;
        assembly {
            dataA := mload(slot)
        }
        Assert.equal(dataA, 0, "");
    }

    function testDup1() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.dup(1);
        Assert.equal(stack.size, 2, "");
        Assert.equal(stack.pop(), 1, "");
        Assert.equal(stack.pop(), 1, "");
    }

    function testDup16() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        for (uint i = 0; i < 16; i++) {
            stack.push(i + 1);
        }
        stack.dup(16);
        Assert.equal(stack.size, 17, "");
        Assert.equal(stack.pop(), 1, "");
        for (uint i = 0; i < 16; i++) {
            Assert.equal(stack.pop(), 16 - i, "");
        }
    }

    function testSwap1() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        for (uint i = 0; i < 17; i++) {
            stack.push(i + 1);
        }
        stack.swap(16);
        Assert.equal(stack.size, 17, "");
        Assert.equal(stack.pop(), 1, "");

        for (uint i = 0; i < 15; i++) {
            stack.pop();
        }
        Assert.equal(stack.pop(), 17, "");
    }

    function testSwap16() public {
        EVMStack.Stack memory stack = EVMStack.newStack();
        stack.push(1);
        stack.push(2);
        stack.swap(1);
        Assert.equal(stack.size, 2, "");
        Assert.equal(stack.pop(), 1, "");
        Assert.equal(stack.pop(), 2, "");
    }
}
