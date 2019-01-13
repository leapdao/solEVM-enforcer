pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;
import "../IEthereumRuntime.sol";
import "../Hash.slb";


contract CompactProofMock {
    IEthereumRuntime public ethRuntime;
    using Hash for uint256[];

    constructor (IEthereumRuntime _ethRuntime) public {
        ethRuntime = _ethRuntime;
    }

    // TODO update later
    // function executeStackHash(
    //     bytes memory code, uint256[4] memory params, uint256[] memory stack, bytes32 stackSibling)
    // public view returns (bytes32) {
    //     bytes32 zeroBytes32 = "";
    //     bytes memory zeroBytes = "";
    //     uint256[] memory zeroArray;
    //     IEthereumRuntime.Result memory result = ethRuntime.execute(
    //         code, zeroBytes, params, stack, zeroBytes, zeroArray, zeroBytes, zeroBytes32
    //     );
    //     return result.stack.toHash(stackSibling);
    // }
}
