pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


contract IEthereumRuntime {

    struct EVMPreimage {
        bytes code;
        bytes data;
        uint gasLimit;
        uint pc;
        uint errno;
        uint gasRemaining;
        uint stepCount;
        uint[] stack;
        bytes mem;
        uint[] accounts;
        bytes accountsCode;
        bytes returnData;
        bytes32 logHash;
    }

    function execute(EVMPreimage memory) public pure returns (EVMPreimage memory);
}
