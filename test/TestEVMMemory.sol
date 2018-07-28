pragma solidity ^0.4.22;
pragma experimental "v0.5.0";
pragma experimental ABIEncoderV2;


import "truffle/Assert.sol";
import {EVMMemory} from "../contracts/EVMMemory.slb";
import {MemOps} from "../contracts/MemOps.slb";


contract TestEVMMemory {
    using EVMMemory for EVMMemory.Memory;

    uint constant internal ALLOC_SIZE = 64;
    uint constant internal WORD_SIZE = 32;

    uint constant internal testVal1 = 55;
    uint constant internal testVal2 = 3246;
    uint constant internal testVal3 = 2;

    function testCreate() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();

        Assert.equal(mem.size, 0, "mem.size");
        Assert.equal(mem.cap, ALLOC_SIZE, "mem.cap");

        uint fMem = MemOps.freeMemPtr();
        Assert.equal(mem.dataPtr + mem.cap*WORD_SIZE, fMem, "freeMemPtr");

        for(uint i = 0; i < ALLOC_SIZE; i++) {
            uint pos = mem.dataPtr + i*WORD_SIZE;
            uint atMem;
            assembly {
                atMem := mload(pos)
            }
            Assert.equal(atMem, 0, "memory position");
        }
    }

    function testSetCapacity() public {
        uint CAP = 117;
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.setCapacity(CAP);

        Assert.equal(mem.size, 0, "memory size");
        Assert.equal(mem.cap, 128, "memory capacity");

        uint fMem = MemOps.freeMemPtr();
        Assert.equal(mem.dataPtr + mem.cap*WORD_SIZE, fMem, "free memory pointer");

        for(uint i = 0; i < 128; i++) {
            uint pos = mem.dataPtr + i*WORD_SIZE;
            uint atMem;
            assembly {
                atMem := mload(pos)
            }
            Assert.equal(atMem, 0, "memory position");
        }
    }

    function testStore8() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.store8(4, 3);
        uint pos = mem.dataPtr + 4;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x0300000000000000000000000000000000000000000000000000000000000000, "");
        Assert.equal(mem.size, 1, "");
    }

    function testStore8Expand() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        uint sAddr = WORD_SIZE*70;
        mem.store8(sAddr, 3);
        Assert.equal(mem.cap, 128, "");
        uint pos = mem.dataPtr + sAddr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x0300000000000000000000000000000000000000000000000000000000000000, "");
        Assert.equal(mem.size, 71, "");
    }

    function testStore() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.store(4, 3);
        uint pos = mem.dataPtr + 4;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x03, "");
        Assert.equal(mem.size, 2, "");
    }

    function testStoreExpand() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        uint sAddr = WORD_SIZE*83;
        mem.store(sAddr, 3);
        Assert.equal(mem.cap, 128, "");
        uint pos = mem.dataPtr + sAddr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x03, "");
        Assert.equal(mem.size, 84, "");
    }

    function testStoreBytes1() public {
        bytes memory bts = hex"01020304";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 0, 0, bts.length);
        uint pos = mem.dataPtr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val >> 8*(32 - bts.length), 0x01020304, "");
        Assert.equal(mem.size, 1, "");
    }

    function testStoreBytes2() public {
        bytes memory bts = hex"01020304050607080102030405060708010203040506070801020304050607080102030405060708";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 0, 0, bts.length);
        uint pos = mem.dataPtr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x0102030405060708010203040506070801020304050607080102030405060708, "");
        pos += 0x20;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val >> 8*(32 - bts.length % 32), 0x0102030405060708, "");
        Assert.equal(mem.size, 2, "");
    }

    function testStoreBytes3() public {
        bytes memory bts = hex"01020304";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 0, 0, 3);
        uint pos = mem.dataPtr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val >> 8*(32 - 3), 0x010203, "");
        Assert.equal(mem.size, 1, "");
    }

    function testStoreBytes4() public {
        bytes memory bts = hex"01020304";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 1, 1, 3);
        uint pos = mem.dataPtr + 1;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val >> 8*(32 - 3), 0x020304, "");
        Assert.equal(mem.size, 1, "");
    }

    function testStoreBytes5() public {
        bytes memory bts = hex"01020304050607080102030405060708010203040506070801020304050607080102030405060708";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 5, 112*WORD_SIZE, 33);
        uint pos = mem.dataPtr + 112*WORD_SIZE;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val, 0x0607080102030405060708010203040506070801020304050607080102030405, "");
        pos += 0x20;
        assembly {
            val := mload(pos)
        }
        Assert.equal(val >> 248, 0x06, "");
        Assert.equal(mem.size, 114, ""); // start is 112 + two words for data.
    }

    function testLoad() public {
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        uint sAddr = 7;
        mem.store(sAddr, 3);
        Assert.equal(mem.load(sAddr), 3, "");
    }

    function testStoreBytesBigArray() public {
        bytes memory bts = new bytes(1513*32);
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 0, 0, bts.length);
        uint pos = mem.dataPtr;
        uint val;
        assembly {
            val := mload(pos)
        }
        Assert.equal(mem.size, 1513, "");
        Assert.equal(mem.cap, 2048, "");
        uint fMem = MemOps.freeMemPtr();
        Assert.equal(mem.dataPtr + mem.cap*WORD_SIZE, fMem, "free memory pointer");
    }

    function getRootHash() public view returns (uint) {
        bytes memory bts = hex"01020304050607080102030405060708010203040506070801020304050607080102030405060708";
        EVMMemory.Memory memory mem = EVMMemory.newMemory();
        mem.storeBytes(bts, 0, 0, bts.length);
        return mem.getRootHash();
    }

}