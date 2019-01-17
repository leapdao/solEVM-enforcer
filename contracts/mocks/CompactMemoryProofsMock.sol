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

    function verify(
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
}
