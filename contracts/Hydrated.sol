pragma solidity ^0.4.24;


contract Hydrated {
    function proveAddOperation(
        bytes32 beforeHash,
        bytes32 afterHash,
    
        uint256 stack1,
        uint256 stack2,
        
        bytes32 sibling,
        bool hasSibling
    ) public pure returns (bool) {
        if (hasSibling) {
          require(
            beforeHash == keccak256(
              abi.encodePacked(
                abi.encodePacked(stack1),
                keccak256(abi.encodePacked(stack2, sibling))
              )
            )
          );
        } else {
          require(
            beforeHash == keccak256(
              abi.encodePacked(
                abi.encodePacked(stack1),
                keccak256(abi.encodePacked(stack2))
              )
            )
          );
        }

        // add two stack elements
        uint256 result = stack1 + stack2;
        
        // check if sibling is there
        if (hasSibling) {
            return afterHash == keccak256(abi.encodePacked(result, sibling));
        }
        
        return afterHash == keccak256(abi.encodePacked(result));
    }
}