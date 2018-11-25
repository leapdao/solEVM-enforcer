pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;
pragma solidity 0.4.24;

import { EthereumRuntime } from "../EthereumRuntime.sol";
import { SimpleHash } from "../SimpleHash.slb";


contract CompactStackProofMock {
    EthereumRuntime public ethRuntime;
    using SimpleHash for uint[];

    event Verification(bytes32 nextStackHash, bytes32 returnStackHash, uint[] nextStack, bool result);

    constructor(address _ethRuntime) public {
        ethRuntime = EthereumRuntime(_ethRuntime);
    }

    function verify(
        bytes code,
        bytes memory data,
        uint[4] memory intInput,
        uint[] memory stack,
        bytes memory mem,
        bytes32 prevStackHash,
        bytes32 stackHashSibling,
        bytes32 nextStackHash
    ) public returns (bool) {
        // verify input stack hash
        if (stack.toHash(stackHashSibling) != prevStackHash) {
            return false;
        }

        // verify output stack hash
        uint[] memory nextStack;
        uint[] memory emptyArr;
        (, nextStack, , , ) = ethRuntime.execute(code, data, intInput, stack, mem, emptyArr, "", emptyArr, "");

        bytes32 resultStackHash = nextStack.toHash(stackHashSibling);
        bool result = resultStackHash == nextStackHash;
        emit Verification(resultStackHash, nextStackHash, nextStack, result);
        return result;
    }
}
