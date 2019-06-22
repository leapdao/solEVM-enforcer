pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "../EVMCode.slb";
import "../MemOps.slb";


contract EVMCodeMock {
    using EVMCode for EVMCode.Code;
    // below is 000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
    uint data0 = 1780731860627700044960722568376592200742329637303199754547598369979440671;
    // below is 202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f
    uint data1 = 14532552714582660066924456880521368950258152170031413196862950297402215317055;
    event FoundByte(uint found);
    event FoundBytes(uint pos, uint len, bytes found, bytes expected);
    bytes test;

    function testFromArrayGetOpcode() public {
        EVMCode.Code memory code;
        EVMCode.RawCode[50] memory rawCodes;

        rawCodes[0] = EVMCode.RawCode(0, data0);
        rawCodes[1] = EVMCode.RawCode(1, data1);
        code = EVMCode.fromArray(rawCodes, 2);
        for (uint i = 0; i < 64; i++) {
            uint opcode = code.getOpcodeAt(i);
            require(opcode == i, 'get wrong opcode');
        }
    }

    function testError_FromArrayWrongOrder() public {
        EVMCode.Code memory code;
        EVMCode.RawCode[50] memory rawCodes;
        rawCodes[0] = EVMCode.RawCode(2, 1);
        rawCodes[1] = EVMCode.RawCode(1, 1);
        code = EVMCode.fromArray(rawCodes, 2);
    }

    function testToUint() public {
        EVMCode.Code memory code;
        EVMCode.RawCode[50] memory rawCodes;

        rawCodes[0] = EVMCode.RawCode(0, data0);
        rawCodes[1] = EVMCode.RawCode(1, data1);
        code = EVMCode.fromArray(rawCodes, 2);

        uint res;
        uint got;

        for (uint pos = 0; pos < 64; pos++) {
            res = 0;
            for (uint len = 1; (len <= 32) && (pos + len <= 64); len++) {
                res = (res << 8) | (pos + len - 1);
                got = code.toUint(pos, len);
                require(res == got, 'get wrong uint');
            }
        }
    }

    function testToBytes() public {
        EVMCode.Code memory code;
        EVMCode.RawCode[50] memory rawCodes;

        rawCodes[0] = EVMCode.RawCode(0, data0);
        rawCodes[1] = EVMCode.RawCode(1, data1);
        code = EVMCode.fromArray(rawCodes, 2);

        test = '';
        bytes memory got;

        for (uint pos = 0; pos < 64; pos++) {
            for (uint len = 1; pos + len <= 64; len++) {
                test.push(byte(uint8(pos + len - 1)));
                got = code.toBytes(pos, len);
                emit FoundBytes(pos, len, got, test);
                // require(keccak256(abi.encodePacked(test)) == keccak256(abi.encodePacked(got)), 'get wrong bytes');
            }
        }
    }
}
