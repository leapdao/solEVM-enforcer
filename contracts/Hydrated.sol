pragma solidity ^0.4.24;

import { IEthereumRuntime } from './EthereumRuntime.sol';

contract Hydrated {
    function unbalancedMerkelRoot(
        uint256[] arr, 
        bytes32 sibling, 
        bool isSibling
    ) public pure returns (bytes32) {
        bytes32 result = 0x0;
        uint256 i = arr.length - 1;
        if (isSibling) {
            result = sibling;            
        }

        while (i >= 0) {
            if (result == 0x0) {
                result = keccak256(abi.encodePacked(arr[i]));
            } else {
                result = keccak256(abi.encodePacked(arr[i], result));
            }

            // break if i == 0
            if (i == 0) {
                break;
            }
            
            // continue with while loop
            i--;
        }
        
        return result;
    }

    function proveArithmeticOperation(
        bytes code,
        bytes32 beforeHash,
        bytes32 afterHash,
    
        // stack
        uint256[] stack,
        
        bytes32 sibling,
        bool hasSibling
    ) public pure returns (bool) {
        require(
            beforeHash == unbalancedMerkelRoot(stack, sibling, hasSibling)
        );

        // add two stack elements
        // uint256 result = stack1 + stack2;
        
        // new stack
        // stack = [result];

        // after hash check
        return afterHash == unbalancedMerkelRoot(stack, sibling, hasSibling);
    }
}