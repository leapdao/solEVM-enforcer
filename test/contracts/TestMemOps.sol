pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;


import "truffle/Assert.sol";
import {MemOps} from "../../contracts/MemOps.slb";


contract TestMemOps {

    uint constant internal WORD_SIZE = 32;

    function testAllocate32() public {
        uint NUM_WORDS = 55;
        uint fMem;
        assembly {
            fMem := mload(0x40)
        }
        MemOps.allocate32(NUM_WORDS);
        uint fMem2;
        assembly {
            fMem2 := mload(0x40)
        }
        Assert.equal(fMem2, fMem + NUM_WORDS*WORD_SIZE, "Free Memory Pointer after alocate32");
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

        uint destPtr;
        assembly {
            destPtr := mload(0x40)
            mstore(0x40, add(destPtr, NUM_WORDS))
        }
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
}
