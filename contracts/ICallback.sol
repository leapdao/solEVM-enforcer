pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


contract ICallback {

    function finalize(bytes32 computationId) public payable;
}
