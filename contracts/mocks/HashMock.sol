pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import {Hash} from "../Hash.slb";


contract HashMock {
    using Hash for uint[];

    function testToHashArray(uint256[] memory array, bytes32 sibling) public pure returns (bytes32) {
        return array.toHash(sibling);
    }
}

