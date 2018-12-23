pragma solidity 0.5.2;
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

    // Init EVM with given stack and memory and execute from the given opcode
    // intInput[0] - pcStart
    // intInput[1] - pcEnd
    // intInput[2] - block gasLimit
    // intInput[3] - tx gasLimit
    function execute(
        bytes memory code, bytes memory data, uint[4] memory intInput, uint[] memory stack,
        bytes memory mem, uint[] memory accounts, bytes memory accountsCode,
        bytes32 logHash
    ) public pure returns (Result memory);
}
