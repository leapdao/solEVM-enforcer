pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;
import "./Hash.slb";


contract IEthereumRuntime {
    using Hash for uint256[];

    struct Result {
        uint errno;
        uint errpc;
        uint pc;
        bytes returnData;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        uint gasRemaining;
        bytes32 logHash;
    }

    function execute(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) public pure returns (Result);

    // this function is only for demonstration purpose
    function executeHash(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) public pure returns (bytes32) {
        Result memory result = execute(code, data, intInput, stack, mem, accounts, accountsCode, logHash);
        return result.stack.toHash(0);
    }
}

