pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;


contract IEthereumRuntime {

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
}

