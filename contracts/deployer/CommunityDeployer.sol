// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";


// add events
// add interface
// add deployment timelock

contract CommunityDeployer {
    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public constant quorumVotes = 1; // TODO: make sure to change before deployment!!!

    uint256 public constant VOTING_PERIOD_IN_SECONDS = 172800; // 2 days
    uint256 public constant TIMELOCK_PERIOD_IN_SECONDS = 172800; // 2 days

    address public constant VOLTZ_GENESIS_NFT =
        0x8C7E68e7706842BFc70053C4cED21500488e73a8;

    uint256 public yesVoteCount;
    uint256 public noVoteCount;

    constructor() {}

    modifier isQuorumReached() {
        require(yesVoteCount >= quorumVotes, "quorum not reached");

        _;
    }

    function deploy() external isQuorumReached {}

    function castVote(uint256 _tokenId, bool _yesVote) external {

        // check if the msg.sender is the owner of _tokenId
        address ownerOfTokenId = ERC721(VOLTZ_GENESIS_NFT).ownerOf(_tokenId);
        require(msg.sender==ownerOfTokenId, "only token owner"); // add a test

        // update the counter
        if (_yesVote) {
            yesVoteCount++;
        } else {
            noVoteCount++;
        }

    }
}
