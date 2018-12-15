pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;
import { SampleVerifier } from "../SampleVerifier.sol";


contract SampleVerifierMock is SampleVerifier {

    constructor(uint256 _timeout) public SampleVerifier(_timeout) {}

    /**
      * @dev this function only for test
      */
    function setState(bytes32 disputeId, States _state) public onlyOwner() {
        disputes[disputeId].state = _state;
    }

    /**
      * @dev this function only for test
      */
    function setTimeout(bytes32 disputeId, uint256 _timeout) public onlyOwner() {
        disputes[disputeId].timeout = _timeout;
    }
}
