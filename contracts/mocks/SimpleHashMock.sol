pragma solidity ^0.4.24;
pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;


import {EVMStack} from "../EVMStack.slb";
import {SimpleHash} from "../SimpleHash.slb";


contract SimpleHashMock {
    using EVMStack for EVMStack.Stack;
    using SimpleHash for EVMStack.Stack;
    using SimpleHash for uint[];

    function testToHashStack(uint[] memory stack, bytes32 sibling) public pure returns (bytes32) {
        return EVMStack.fromArray(stack).toHash(sibling);
    }

    function testToHashArray(uint[] memory array, bytes32 sibling) public pure returns (bytes32) {
        return array.toHash(sibling);
    }
}

