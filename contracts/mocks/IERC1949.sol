pragma solidity 0.5.2;

/**
 * @dev Interface of the ERC1949 contract.
 */
interface IERC1949 {

    /**
     * @dev allows to mint new tokens if `msg.sender` or `to` is owner
     * of a delegate token.
     */
    function breed(uint256 tokenId, address to, bytes32 tokenData) external;

}
