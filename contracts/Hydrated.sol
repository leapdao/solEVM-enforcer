pragma solidity ^0.4.24;


contract Hydrated {
    function proveAddOperation(
        bytes32 beforeHash,
        bytes32 afterHash,
    
        uint256 stack1,
        uint256 stack2,
        
        bytes stack1Proof,
        bytes stack2Proof,
        
        bytes32 sibling,
        bool hasSibling
    ) public pure returns (bool) {
        // check if both stack elements are different
        require(keccak256(stack1) != keccak256(stack2));
        
        // add two stack elements
        uint256 result = stack1 + stack2;
        
        // check if sibling is there
        if (hasSibling) {
            return afterHash == keccak256(abi.encodePacked(result, sibling));
        }
        
        return afterHash == keccak256(abi.encodePacked(result));
    }
}