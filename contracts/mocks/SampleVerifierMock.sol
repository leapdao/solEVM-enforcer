pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;
import { SampleVerifier } from "../SampleVerifier.sol";


contract SampleVerifierMock is SampleVerifier {

    // solhint-disable-next-line no-empty-blocks
    constructor(uint256 _timeout) public SampleVerifier(_timeout) {}

    /**
      * @dev this function only for test
      */
    function setState(bytes32 disputeId, States _state) public {
        disputes[disputeId].state = _state;
    }

    /**
      * @dev this function only for test
      */
    function setTimeout(bytes32 disputeId, uint256 _timeout) public {
        disputes[disputeId].timeout = _timeout;
    }

    /**
      * @dev this function only for test
      */
    function setLeft(bytes32 disputeId, bytes32 _hash, uint256 _step) public {
        disputes[disputeId].left = StateHash(_hash, _step);
    }

    /**
      * @dev this function only for test
      */
    function setRight(bytes32 disputeId, bytes32 _hash, uint256 _step) public {
        disputes[disputeId].right = StateHash(_hash, _step);
    }
}
