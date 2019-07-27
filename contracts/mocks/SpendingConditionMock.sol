pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "./IERC1948.sol";
import "./IERC1949.sol";


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

    function testERC20(address tokenAddr, address alice, address bob, uint256 value) public {
        IERC20 token = IERC20(tokenAddr);
        uint balance = token.balanceOf(alice);
        uint allowance = token.allowance(alice, address(this));
        require(balance > 0 && allowance <= balance);
        token.transferFrom(alice, bob, allowance);
        require(token.balanceOf(alice) == balance - allowance);
        require(token.allowance(alice, address(this)) == 0);
        require(token.balanceOf(bob) == allowance);
        balance = token.balanceOf(address(this)) - 1;
        token.transfer(alice, balance);
        token.transfer(address(uint160(address(this)) - 1), 1);
    }

    function testERC721(address tokenAddr, address alice, address bob, uint256 tokenId) public {
        IERC721 token = IERC721(tokenAddr);
        address owner = token.ownerOf(tokenId);
        require(owner == alice);
        require(token.getApproved(tokenId) == address(this));
        token.transferFrom(alice, bob, tokenId);
    }

    function testERC1948(address tokenAddr, address alice, address bob, uint256 tokenId) public {
        IERC1948 token = IERC1948(tokenAddr);
        uint256 data = uint256(token.readData(tokenId)) + 1;
        token.writeData(tokenId, bytes32(data));
    }

    function testERC1949(address tokenAddr, address alice, address bob, uint256 tokenId) public {
        IERC1949 token = IERC1949(tokenAddr);
        token.breed(tokenId, bob, bytes32(uint256(0x0a)));
    }
}
