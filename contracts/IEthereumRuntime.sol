pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


contract IEthereumRuntime {

    struct EVMPreimage {
        address code;
        bytes data;
        uint gasLimit;
        uint pc;
        uint8 errno;
        uint gasRemaining;
        uint stepCount;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        bytes returnData;
        bytes32 logHash;
    }

    struct EVMResult {
        uint gas;
        bytes data;
        bytes lastRet;
        bytes returnData;
        uint8 errno;
        uint[] accounts;
        bytes accountsCode;
        bytes mem;
        uint[] stack;
        uint16 depth;
        // uint n;
        uint pc;
        bytes32 logHash;
        bytes32 hashValue;
    }

    function execute(EVMPreimage memory) public returns (EVMResult memory);
}
