pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";


contract SpendingConditionMock {
    address constant SPENDER_ADDR = 0xF3beAC30C498D9E26865F34fCAa57dBB935b0D74;

    function test(address tokenAddr, address[] memory receivers, uint[] memory amounts) public {
        IERC20 token = IERC20(tokenAddr);
        IERC721 nft = IERC721(tokenAddr);

        for (uint i = 0; i < receivers.length; i++) {
            token.transfer(receivers[i], amounts[i]);
            token.balanceOf(receivers[i]);
            // transferFrom(from, to, tokenid)
            nft.balanceOf(receivers[i]);
        }
    }

    function fulfil(
        // signature
        bytes32 r, bytes32 s, uint8 v,
        // input
        address tokenAddr,
        // outputs
        address[] memory receivers,
        uint256[] memory amounts) public
    {
        require(receivers.length == amounts.length);

        // check signature
        address signer = ecrecover(bytes32(bytes20(address(this))), v, r, s);
        require(signer == SPENDER_ADDR);

        // do transfer
        IERC20 token = IERC20(tokenAddr);
        for (uint i = 0; i < receivers.length; i++) {
            token.transfer(receivers[i], amounts[i]);
        }
    }
}
