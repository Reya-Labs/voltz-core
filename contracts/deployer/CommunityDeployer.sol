// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "../Factory.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IMarginEngine.sol";




// we are unable to deploy both the master vamm and the master margin engine in this contract since in that scenario it would
// exceed the maximum contract size limit, instead we deploy the master margin engine and master vamm separately and link their addresses
// to the community deployer as constants





// todo: deploy community depoloyer on rinkeby, link to the voltz nft on rinkeby
// todo: verify with etherscan
// todo: cast vote in the UI
// todo: show the total yes/no votes in the UI
// todo: show the start and end timestamps for voting and timelock in the UI
// todo: show the quorum in the UI (can be hardcoded actually)
// todo: queue in the UI
// todo: deploy in the UI
// todo: need to agree on the quorum
// todo assign ownership of the factory to the gnosis safe multisig after the deployment

contract CommunityDeployer {
    /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
    uint256 public constant QUORUM_VOTES = 1; // TODO: make sure to change before deployment!!!

    /// @notice Voting Period In Seconds, i.e. after 2 days elapse since the deployement of this contract, nft holders won't be able to vote
    uint256 public constant VOTING_PERIOD_IN_SECONDS = 172800; // 2 days

    /// @notice Timelock Period In Seconds, once the deployment is queued, 2 days need to pass in order to make deployment of the Voltz Factory possible
    uint256 public constant TIMELOCK_PERIOD_IN_SECONDS = 172800; // 2 days

    /// @notice Volts Genesis NFT mainnet address
    address public constant VOLTZ_GENESIS_NFT =
        0x8C7E68e7706842BFc70053C4cED21500488e73a8; // todo: ensure this is the correct address
    
    // https://testnets.opensea.io/assets/0x6e51888cb440397e4f079e365149dd614e8c3304/1390849295786071768276380950238675083608645509734
    // https://rinkeby.etherscan.io/token/0x6e51888cb440397e4f079e365149dd614e8c3304
    // uncomment for rinkeby
    // address public constant VOLTZ_GENESIS_NFT =
    //     0x6e51888CB440397e4F079E365149dD614e8c3304; // todo: ensure this is the correct address

    /// @notice Master Margine Engine of Voltz Protocol
    IMarginEngine public constant masterMarginEngine =
        IMarginEngine(address(0x15e3484EB4Ae66B9186699DB76024cBC363c1f2B)); // todo: replace with the correct mainnet address once deployedx

    /// @notice Master VAMM of Voltz Protocol
    IVAMM public constant masterVAMM = IVAMM(address(0x15e3484EB4Ae66B9186699DB76024cBC363c1f2B)); // todo: replace with the correct mainnet address once deployed

    /// @notice Total number of votes in favour of deploying voltz protocol
    uint256 public yesVoteCount;

    /// @notice Total number of votes against the deployment of voltz protocol
    uint256 public noVoteCount;

    /// @notice mapping of voltz genesis token ids to a boolean, if true that means the token id has already voted
    mapping(uint256 => bool) public hasTokenIdVoted;

    /// @notice voting end block timestamp (once this contract is deployed, voting is considered to be officially started)
    uint256 public blockTimestampVotingEnd;

    /// @notice timelock end block timestamp (once the proposal is queued, the timelock period pre-deployment is considered to be officially started)
    uint256 public blockTimestampTimelockEnd;

    /// @notice isQueued needs to be true in order for the timelock period to start in advance of the deployment
    bool public isQueued;

    /// @notice Voltz Factory to be deployed in a scenario where a successful vote is followed by the queue and deployment
    IFactory public voltzFactory;

    constructor() {
        blockTimestampVotingEnd = block.timestamp + VOTING_PERIOD_IN_SECONDS;
    }

    /// @notice Deploy the Voltz Factory by passing the masterVAMM and the masterMarginEngine into the Factory constructor
    function deploy() external {
        require(isQueued, "not queued");
        require(
            block.timestamp > blockTimestampTimelockEnd,
            "timelock is ongoing"
        );
        voltzFactory = new Factory(masterMarginEngine, masterVAMM);
    }

    /// @notice Queue the deployment of the Voltz Factory
    function queue() external {
        require(block.timestamp > blockTimestampVotingEnd, "voting is ongoing");
        require(yesVoteCount >= QUORUM_VOTES, "quorum not reached");
        require(yesVoteCount > noVoteCount, "no >= yes");
        require(isQueued == false, "already queued"); // todo: test this
        isQueued = true;
        blockTimestampTimelockEnd =
            block.timestamp +
            TIMELOCK_PERIOD_IN_SECONDS;
    }

    /// @notice Vote for the proposal to deploy the Voltz Factory contract
    /// @param _tokenId id of the ERC721 Voltz Genesis NFT token which is used to vote
    /// @param _yesVote if this boolean is true then the msg.sender is casting a yes vote, if the boolean is false the msg.sender is casting a no vote
    function castVote(uint256 _tokenId, bool _yesVote) external {
        require(
            block.timestamp <= blockTimestampVotingEnd,
            "voting period over"
        );

        // check if the msg.sender is the owner of _tokenId
        address ownerOfTokenId = ERC721(VOLTZ_GENESIS_NFT).ownerOf(_tokenId);
        require(msg.sender == ownerOfTokenId, "only token owner");
        require(hasTokenIdVoted[_tokenId] == false, "duplicate vote");

        // update the counter
        if (_yesVote) {
            yesVoteCount++;
        } else {
            noVoteCount++;
        }

        // update the hasTokenIdVoted mapping to ensure the token id cannot be reused for a duplicate vote
        hasTokenIdVoted[_tokenId] = true;
    }
}
