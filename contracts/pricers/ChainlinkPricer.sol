pragma solidity ^0.8.0;

import {IVoltzMarginPricer} from "../interfaces/IVoltzMarginPricer.sol";
import "../interfaces/IMarginOracle.sol";
import "../interfaces/IAggregator.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @notice A Pricer contract for one underlying pool as reported by Chainlink
 */

// contract ChainLinkPricer is IVoltzMarginPricer {
contract ChainLinkPricer {
    using SafeMath for uint256; // todo: fine to use SafeMath in here?

    /// @dev base decimals
    uint256 internal constant BASE = 18;

    /// @notice chainlink response decimals
    uint256 public aggregatorDecimals;

    /// @notice the opyn oracle address
    IMarginOracle public oracle;

    /// @notice the aggregator for the underlying pool
    IAggregator public aggregator;
    address public underlyingPool;

    /// @notice bot address that is allowed to call []
    address public bot;

    /**
     * @param _bot priveleged address that can call setConfidenceBoundInOracle
     * @param _underlyingPool underlying pool that this pricer will get a confidence bound for
     * @param _aggregator Chainlink aggregator contract for the underlying pool
     * @param _oracle Voltz Margin Oracle address
     */
    constructor(
        address _bot,
        address _underlyingPool,
        address _aggregator,
        address _oracle
    ) public {
        require(
            _bot != address(0),
            "ChainLinkPricer: Cannot set 0 address as bot"
        );
        require(
            _oracle != address(0),
            "ChainLinkPricer: Cannot set 0 address as oracle"
        );
        require(
            _aggregator != address(0),
            "ChainLinkPricer: Cannot set 0 address as aggregator"
        );

        bot = _bot;
        oracle = IMarginOracle(_oracle);
        aggregator = IAggregator(_aggregator);
        underlyingPool = _underlyingPool;

        aggregatorDecimals = uint256(aggregator.decimals());
    }

    /**
     * @notice modifier to check if sender address is equal to bot address
     */
    modifier onlyBot() {
        require(msg.sender == bot, "ChainLinkPricer: unauthorized sender");

        _;
    }

    /**
     * @notice set the confidence bound in the oracle, can only be called by Bot address
     */
    function setConfidenceBoundInOracle(bool isLower, uint80 _roundId)
        external
        onlyBot
    {
        (, int256 confidenceBound, , uint256 roundTimestamp, ) = aggregator
            .getRoundData(_roundId);

        // require(_expiryTimestamp <= roundTimestamp, "ChainLinkPricer: invalid roundId"); todo: is this relevant to Voltz?

        oracle.setConfidenceBound(
            underlyingPool,
            uint256(confidenceBound),
            isLower
        );
    }

    /**
     * @notice get the live confidence bound for the asset
     * @dev overides the getConfidenceBound function in IVoltzMarginPricer
     * @return confidence bound of the underlyingPool
     */
    // todo: add to the interface
    function getConfidenceBound() external view returns (uint256) {
        (, int256 answer, , , ) = aggregator.latestRoundData(); // todo: can you pass isLower to the aggregator,

        require(answer > 0, "ChainLinkPricer: confidenceBound is lower than 0");

        // chainlink's answer is 1e8
        return _scaleToBase(uint256(answer));
    }

    // todo: not sure this is necessary
    // /**
    //  * @notice get historical chainlink price
    //  * @param _roundId chainlink round id
    //  * @return round price and timestamp
    //  */
    // function getHistoricalPrice(uint80 _roundId) external view override returns (uint256, uint256) {
    //     (, int256 price, , uint256 roundTimestamp, ) = aggregator.getRoundData(_roundId);
    //     return (_scaleToBase(uint256(price)), roundTimestamp);
    // }

    /**
     * @notice scale aggregator response to base decimals (1e18)
     * @param _confidenceBound aggregator confidence bound
     * @return price scaled to 1e18
     */
    function _scaleToBase(uint256 _confidenceBound)
        internal
        view
        returns (uint256)
    {
        if (aggregatorDecimals > BASE) {
            uint256 exp = aggregatorDecimals.sub(BASE);
            _confidenceBound = _confidenceBound.div(10**exp);
        } else if (aggregatorDecimals < BASE) {
            uint256 exp = BASE.sub(aggregatorDecimals);
            _confidenceBound = _confidenceBound.mul(10**exp);
        }

        return _confidenceBound;
    }
}
