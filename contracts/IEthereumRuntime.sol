pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


contract IEthereumRuntime {

    struct Result {
        uint errno;
        uint pc;
        bytes returnData;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        uint gasRemaining;
        bytes32 logHash;
    }

    struct EVMPreimage {
        bytes code;
        bytes data;
        uint gasLimit;
        uint pc;
        uint gasRemaining;
        uint stepCount;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        bytes32 logHash;
    }

    function execute(EVMPreimage memory) public pure returns (Result memory);
}
