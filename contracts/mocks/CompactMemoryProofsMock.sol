pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import {EthereumRuntime} from "../EthereumRuntime.sol";
import {EVMMemory} from "../EVMMemory.slb";
import {MerkleProof} from "../MerkleProof.slb";

contract CompactMemoryProofsMock {
	using EVMMemory for EVMMemory.Memory;

    EthereumRuntime public ethRuntime;

    constructor(address _ethRuntime) public {
        ethRuntime = EthereumRuntime(_ethRuntime);
    }

    function verifyMload(
    	EthereumRuntime.EVMPreimage memory img,
        bytes32[] memory memProof,
        bytes32 rootMemHash,
        uint256 memPosition
    ) public view returns(bool){
        EthereumRuntime.EVMPreimage memory result = ethRuntime.execute(img);
        require(result.mem.length == img.mem.length, 'operation accessed memory other than the leaf');
        
        EVMMemory.Memory memory mem = EVMMemory.fromArray(result.mem);
        bytes32 leaf = mem.getRootHash();

        return MerkleProof.verify(memProof, rootMemHash, leaf, memPosition);
    }

    function verifyMstore(
        EthereumRuntime.EVMPreimage memory img,
        bytes32[] memory memProof,
        bytes32 previousRootMemHash,
        bytes32 newRootMemHash,
        uint256 memPosition
    ) public view returns(bool){
        bytes32 leaf;
        EVMMemory.Memory memory initMem = EVMMemory.fromArray(img.mem);
        leaf = initMem.getRootHash();
        require (MerkleProof.verify(memProof, previousRootMemHash, leaf, memPosition), "initial memory proof invalid");
        
        EthereumRuntime.EVMPreimage memory result = ethRuntime.execute(img);
        require(result.mem.length == img.mem.length, 'operation accessed memory other than the leaf');
        
        EVMMemory.Memory memory finalMem = EVMMemory.fromArray(result.mem);
        leaf = finalMem.getRootHash();
        return MerkleProof.verify(memProof, newRootMemHash, leaf, memPosition);
    }
}
