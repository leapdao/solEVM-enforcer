pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import "truffle/Assert.sol";
import {CompactEVMStack} from "../contracts/CompactEVMStack.slb";


contract TestCompactEVMStack {
    using CompactEVMStack for CompactEVMStack.Stack;

    function testCreate() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();

        Assert.equal(stack.size, uint256(0), "");
        Assert.equal(stack.dataLength, uint256(0), "");
        Assert.equal(stack.sibling, "", "");
    }

    function testPush() public {
        uint data = 1234;
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        stack.push(data);

        Assert.equal(stack.data[0], data, "");
        Assert.equal(stack.size, uint256(1), "");
        Assert.equal(stack.dataLength, uint256(1), "");
    }

    function testPop() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        stack.push(1);
        uint data = stack.pop();
        Assert.equal(stack.size, uint256(0), "");
        Assert.equal(data, uint256(1), "");
    }

    function testDup1() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        stack.push(1);
        stack.dup(1);
        Assert.equal(stack.size, 2, "");
        Assert.equal(stack.pop(), uint256(1), "");
        Assert.equal(stack.pop(), uint256(1), "");
    }

    function testDup16() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        for (uint i = 0; i < 16; i++) {
            stack.push(i + 1);
        }
        stack.dup(16);
        Assert.equal(stack.size, uint256(17), "");
        Assert.equal(stack.pop(), 1, "");
        for (uint i = 0; i < 16; i++) {
            Assert.equal(stack.pop(), uint256(16 - i), "");
        }
    }

    function testSwap1() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        for (uint i = 0; i < 17; i++) {
            stack.push(i + 1);
        }
        stack.swap(16);
        Assert.equal(stack.size, uint256(17), "");
        Assert.equal(stack.pop(), uint256(1), "");

        for (uint i = 0; i < 15; i++) {
            stack.pop();
        }
        Assert.equal(stack.pop(), uint256(17), "");
    }

    function testSwap16() public {
        CompactEVMStack.Stack memory stack = CompactEVMStack.newStack();
        stack.push(1);
        stack.push(2);
        stack.swap(1);
        Assert.equal(stack.size, uint256(2), "");
        Assert.equal(stack.pop(), uint256(1), "");
        Assert.equal(stack.pop(), uint256(2), "");
    }
}
