pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "../EthereumRuntime.sol";
import "../CompactEthereumRuntime.sol";


contract CompactProofMock {
    EthereumRuntime public ethRuntime;
    CompactEthereumRuntime public compactEthRuntime;
    bool public executed;

    constructor (EthereumRuntime _ethRuntime, CompactEthereumRuntime _compactEthRuntime) public {
        ethRuntime = _ethRuntime;
        compactEthRuntime = _compactEthRuntime;
    }

    function mockCompactExecute(CompactEthereumRuntime.CompactEVMPreimage memory evmPreimage)
    public returns (CompactEthereumRuntime.CompactEVMPreimage memory) {
        executed = true;
        return compactEthRuntime.compactExecute(evmPreimage);
    }

    function mockExecute(EthereumRuntime.EVMPreimage memory evmPreimage)
    public returns (EthereumRuntime.EVMPreimage memory) {
        executed = true;
        return ethRuntime.execute(evmPreimage);
    }
}
