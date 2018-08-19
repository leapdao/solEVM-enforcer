pragma solidity ^0.4.24;

import { EVMMemory } from "./EVMMemory.slb";
import { EVMStack } from "./EVMStack.slb";
import { IEthereumRuntime, EthereumRuntime } from './EthereumRuntime.sol';

contract Hydrated {
    using EVMMemory for EVMMemory.Memory;
    using EVMStack for EVMStack.Stack;

    EthereumRuntime public ethereumRuntime;

    constructor (address _ethereumRuntime) public {
        ethereumRuntime = EthereumRuntime(_ethereumRuntime);
    }

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
    ) public view returns (bool) {
        require(
            beforeHash == unbalancedMerkelRoot(stack, sibling, hasSibling)
        );

        // execute
        bytes memory data;
        uint256[] memory result;
        (,,,result,,,,,) = ethereumRuntime.executeWithStack(code, data, stack);

        // after hash check
        return afterHash == unbalancedMerkelRoot(result, sibling, hasSibling);
    }
}