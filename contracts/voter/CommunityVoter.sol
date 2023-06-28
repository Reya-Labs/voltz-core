// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract CommunityVoter {
    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public quorumVotes;

    /// @notice Total number of votes in favour of deploying voltz protocol
    uint256 public yesVoteCount;

    /// @notice Total number of votes against the deployment of voltz protocol
    uint256 public noVoteCount;

    /// @notice mapping of voltz genesis token ids to a boolean, if true that means the token id has already voted
    mapping(uint256 => bool) public hasTokenIdVoted;

    /// @notice voting end block timestamp (once this contract is deployed, voting is considered to be officially started)
    uint256 public blockTimestampVotingEnd;

    // Merkle Tree
    bytes32 public merkleRoot;

    // This is a packed array of booleans.
    mapping(uint256 => uint256) private votedBitMap;

    // This event is triggered whenever a call to cast a vote succeeds
    event Voted(
        uint256 index,
        address account,
        uint256 numberOfVotes,
        bool yesVote
    );

    constructor(
        uint256 _quorumVotes,
        bytes32 _merkleRoot,
        uint256 _blockTimestampVotingEnd
    ) {
        blockTimestampVotingEnd = _blockTimestampVotingEnd;
        quorumVotes = _quorumVotes;
        merkleRoot = _merkleRoot;
    }

    function hasVoted(uint256 index) public view returns (bool) {
        uint256 votedWordIndex = index / 256;
        uint256 votedBitIndex = index % 256;
        uint256 votedWord = votedBitMap[votedWordIndex];
        uint256 mask = (1 << votedBitIndex);
        return votedWord & mask == mask;
    }

    function _setVoted(uint256 index) private {
        uint256 votedWordIndex = index / 256;
        uint256 votedBitIndex = index % 256;
        votedBitMap[votedWordIndex] =
            votedBitMap[votedWordIndex] |
            (1 << votedBitIndex);
    }

    /// @notice Vote for the proposal
    /// @param _index index of the voter
    /// @param _numberOfVotes number of voltz nfts and sbts held by the msg.sender before the snapshot was taken
    /// @param _yesVote if this boolean is true then the msg.sender is casting a yes vote, if the boolean is false the msg.sender is casting a no vote
    /// @param _merkleProof merkle proof that needs to be verified against the merkle root to check the msg.sender against the snapshot
    function castVote(
        uint256 _index,
        uint256 _numberOfVotes,
        bool _yesVote,
        bytes32[] calldata _merkleProof
    ) external {
        require(
            block.timestamp <= blockTimestampVotingEnd,
            "voting period over"
        );

        // check if msg.sender has already voted
        require(!hasVoted(_index), "duplicate vote");

        // verify the merkle proof
        bytes32 _node = keccak256(
            abi.encodePacked(_index, msg.sender, _numberOfVotes)
        );
        require(
            MerkleProof.verify(_merkleProof, merkleRoot, _node),
            "invalid merkle proof"
        );

        // mark hasVoted
        _setVoted(_index);

        // cast the vote
        if (_yesVote) {
            yesVoteCount += _numberOfVotes;
        } else {
            noVoteCount += _numberOfVotes;
        }

        // emit an event
        emit Voted(_index, msg.sender, _numberOfVotes, _yesVote);
    }
}
