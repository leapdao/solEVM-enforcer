pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import {Hash} from "../Hash.slb";


contract HashMock {
    using Hash for uint[];

    function hashArray(uint256[] memory array) public pure returns (bytes32) {
        return array.toHash();
    }

    function hashArrayWithSibling(uint256[] memory array, uint256 size, bytes32 sibling) public pure returns (bytes32) {
        return array.toHashWithSibling(size, sibling);
    }
}

