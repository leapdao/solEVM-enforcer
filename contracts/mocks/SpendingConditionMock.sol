pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";


contract SpendingConditionMock {
    address constant SPENDER_ADDR = 0xF3beAC30C498D9E26865F34fCAa57dBB935b0D74;

    function test(address _tokenAddr, address[] memory _receivers, uint[] memory _amounts) public {
        IERC20 token = IERC20(_tokenAddr);
        IERC721 nft = IERC721(_tokenAddr);

        for (uint i = 0; i < _receivers.length; i++) {
            token.transfer(_receivers[i], _amounts[i]);
            token.balanceOf(_receivers[i]);
            // transferFrom(from, to, tokenid)
            nft.balanceOf(_receivers[i]);
        }
    }
    /*
    function fulfil(bytes32 _r, bytes32 _s, uint8 _v,      // signature
        address _tokenAddr,                               // inputs
        address[] _receivers, uint256[] _amounts) public {  // outputs
            require(_receivers.length == _amounts.length);

            // check signature
            address signer = ecrecover(bytes32(this), _v, _r, _s);
            require(signer == SPENDER_ADDR);

            // do transfer
            ERC20Basic token = ERC20Basic(_tokenAddr);
            for (uint i = 0; i < _receivers.length; i++) {
                token.transfer(_receivers[i], _amounts[i]);
            }
        }*/
}
