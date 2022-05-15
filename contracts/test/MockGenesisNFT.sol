// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockGenesisNFT is ERC721 {

    constructor() ERC721("Mock Genesis NFT", "VUNI") {}

    function mint(uint256 _tokenId) external {
        super._mint(msg.sender, _tokenId);
    }

}