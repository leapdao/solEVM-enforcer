pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../EVMCode.slb";


contract EVMCodeMock {
    using EVMCode for EVMCode.Code;

    function testFindFragment(bytes32[] memory rawCodes, uint codeLength, uint pos)
    public view returns (EVMCode.DataNode memory res) {
        EVMCode.Code memory code = EVMCode.fromArray(rawCodes, codeLength);
        res = code.findFragment(pos);
    }

    function testToUint(bytes32[] memory rawCodes, uint codeLength, uint pos, uint length)
    public view returns (uint res) {
        EVMCode.Code memory code = EVMCode.fromArray(rawCodes, codeLength);
        res = code.toUint(pos, length);
    }

    function testToBytes(bytes32[] memory rawCodes, uint codeLength, uint pos, uint length)
    public view returns (bytes memory res) {
        EVMCode.Code memory code = EVMCode.fromArray(rawCodes, codeLength);
        res = code.toBytes(pos, length);
    }
}
