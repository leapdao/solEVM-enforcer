pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../EVMCode.slb";


contract EVMCodeMock {
    using EVMCode for EVMCode.Code;

    function testToUint(EVMCode.RawCode[] memory rawCodes, uint codeFragLength, uint codeLength, uint pos, uint length)
        public view returns (uint res) {
        EVMCode.Code memory code = EVMCode.fromArray(rawCodes, codeFragLength, codeLength);
        res = code.toUint(pos, length);
    }
}
