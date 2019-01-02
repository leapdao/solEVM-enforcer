pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;


import "truffle/Assert.sol";
import {MemOps} from "../contracts/MemOps.slb";


contract TestMemOps {

    uint constant internal WORD_SIZE = 32;

    function testFreeMemPtr() public {
        uint fMemAsm;
        assembly {
            fMemAsm := mload(0x40)
        }
        Assert.equal(fMemAsm, MemOps.freeMemPtr(), "Free Memory Pointer empty");
    }

    function testAllocate() public {
        uint NUM_BYTES = 217;
        uint fMem = MemOps.freeMemPtr();
        MemOps.allocate(NUM_BYTES);
        uint fMem2 = MemOps.freeMemPtr();
        Assert.equal(fMem2, fMem + NUM_BYTES, "Free Memory Pointer after alocate");
    }

    function testAllocate32() public {
        uint NUM_WORDS = 55;
        uint fMem = MemOps.freeMemPtr();
        MemOps.allocate32(NUM_WORDS);
        uint fMem2 = MemOps.freeMemPtr();
        Assert.equal(fMem2, fMem + NUM_WORDS*WORD_SIZE, "Free Memory Pointer after alocate32");
    }

    function testMemcopyNoTail() public {
        uint WORDS = 20;
        uint srcPtr = MemOps.allocate32(WORDS);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = srcPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }

        uint destPtr = MemOps.allocate32(WORDS);
        MemOps.memcopy(srcPtr, destPtr, WORDS*WORD_SIZE);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = destPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, i + 1, "Memory Copy No Tail");
        }
    }

    function testMemcopyWithTail() public {
        uint WORDS = 20;
        uint LENGTH = WORDS*WORD_SIZE + 23;

        uint srcPtr = MemOps.allocate(LENGTH);
        for (uint i = 0; i < WORDS; i++) {
            uint pos = srcPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }
        uint tailPtr = srcPtr + WORDS*WORD_SIZE;
        uint tailVal = 0x0101010101010101010101010101010101010101010101000000000000000000;
        assembly {
            mstore(tailPtr, tailVal)
        }

        uint destPtr = MemOps.allocate(LENGTH);
        MemOps.memcopy(srcPtr, destPtr, LENGTH);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = destPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, i + 1, "memcopy with tail");
        }
        tailPtr = destPtr + WORDS*WORD_SIZE;
        uint tailVal2;
        assembly {
            tailVal2 := mload(tailPtr)
        }
        Assert.equal(tailVal2, tailVal, "Memory Copy With Tail");
    }

    function testMemcopy32() public {
        uint NUM_WORDS = 20;
        uint srcPtr = MemOps.allocate32(NUM_WORDS);

        for (uint i = 0; i < NUM_WORDS; i++) {
            uint pos = srcPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }

        uint destPtr = MemOps.allocate(NUM_WORDS);
        MemOps.memcopy32(srcPtr, destPtr, NUM_WORDS);

        for (uint i = 0; i < NUM_WORDS; i++) {
            uint pos = srcPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, i + 1, "memcopy32");
        }
    }

    function testMemclearNoTail() public {
        uint WORDS = 20;
        uint startPtr = MemOps.allocate32(WORDS);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }

        MemOps.memclear(startPtr, WORDS*WORD_SIZE);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, 0, "memclear no tail");
        }
    }

    function testMemclearWithTail() public {
        uint WORDS = 20;
        uint LENGTH = WORDS*WORD_SIZE + 23;
        uint startPtr = MemOps.allocate(LENGTH);
        for (uint i = 0; i < WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }
        uint tailPtr = startPtr + WORDS*WORD_SIZE;
        uint tailVal = 0x0101010101010101010101010101010101010101010101000000000000000000;
        assembly {
            mstore(tailPtr, tailVal)
        }

        MemOps.memclear(startPtr, LENGTH);

        for (uint i = 0; i < WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, 0, "memclear with tail");
        }
        tailPtr = startPtr + WORDS*WORD_SIZE;
        uint tailVal2;
        assembly {
            tailVal2 := mload(tailPtr)
        }
        Assert.equal(tailVal2, 0, "memclear with tail");
    }

    function testMemclear32() public {
        uint NUM_WORDS = 20;

        uint startPtr = MemOps.allocate32(NUM_WORDS);

        for (uint i = 0; i < NUM_WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            assembly {
                mstore(pos, add(i, 1))
            }
        }

        MemOps.memclear32(startPtr, NUM_WORDS);

        for (uint i = 0; i < NUM_WORDS; i++) {
            uint pos = startPtr + i*WORD_SIZE;
            uint val = 0;
            assembly {
                val := mload(pos)
            }
            Assert.equal(val, 0, "memclear32");
        }
    }

}
