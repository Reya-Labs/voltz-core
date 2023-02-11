// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IGlpRateOracle.sol";
import "../interfaces/glp/IRewardTracker.sol";
import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IRewardRouter.sol";
import "../interfaces/glp/IGlpManager.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GlpRateOracle is BaseRateOracle, IGlpRateOracle {
    /// @inheritdoc IGlpRateOracle
    IRewardRouter public override rewardRouter;
    using OracleBuffer for OracleBuffer.Observation[65535];

    uint256 public constant GLP_PRECISION = 1e30;

    uint256 public lastEthGlpPrice;
    uint256 public lastCumulativeRewardPerToken;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 8;

    constructor(
        IRewardRouter _rewardRouter,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results,
        uint256 _lastEthGlpPrice,
        uint256 _lastCumulativeRewardPerToken
    ) BaseRateOracle(_underlying) {
        require(
            address(_rewardRouter) != address(0),
            "GLP reward router must exist"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        rewardRouter = _rewardRouter;

        _populateInitialObservationsCustom(_times, _results, false);
        lastEthGlpPrice = _lastEthGlpPrice;
        lastCumulativeRewardPerToken = _lastCumulativeRewardPerToken;
    }

    /// @inheritdoc IRateOracle
    function writeOracleEntry()
        external
        virtual
        override(BaseRateOracle, IRateOracle)
    {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
        pupulateLastGlpData();
    }

    /// @dev must be called after every write to the oracle buffer
    function pupulateLastGlpData() internal {
        IGlpManager glpManager = IGlpManager(rewardRouter.glpManager());
        IVault vault = glpManager.vault();
        IRewardTracker rewardTracker = IRewardTracker(
            rewardRouter.feeGlpTracker()
        );
        IERC20 glp = IERC20(glpManager.glp());

        // average over min & max prce of GLP price feeds
        // see https://github.com/gmx-io/gmx-contracts/blob/master/contracts/core/VaultPriceFeed.sol
        address rewardToken = rewardTracker.rewardToken();
        uint256 ethPriceMin = vault.getMinPrice(rewardToken); // 30 decimals precision
        uint256 ethPriceMax = vault.getMaxPrice(rewardToken);
        uint256 glpSupply = glp.totalSupply();
        uint256 glpPriceMin = glpManager.getAum(false) / glpSupply; // min price
        uint256 glpPriceMax = glpManager.getAum(true) / glpSupply; // max price

        require(
            ethPriceMin + ethPriceMax > 0 && glpPriceMin + glpPriceMax > 0,
            "Failed to get GLP price"
        );

        uint256 ethGlpPrice = ((ethPriceMin + ethPriceMax) * GLP_PRECISION) /
            (glpPriceMin + glpPriceMax);

        lastEthGlpPrice = ethGlpPrice;
        lastCumulativeRewardPerToken = rewardTracker.cumulativeRewardPerToken();
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        // get last observation
        uint216 lastIndexRay = observations[oracleVars.rateIndex].observedValue;
        require(lastIndexRay > 0, "No previous observation");

        // all required contracts
        IRewardTracker rewardTracker = IRewardTracker(
            rewardRouter.feeGlpTracker()
        );

        // calculate rate increase since last update
        uint256 cumulativeRewardPerToken = rewardTracker
            .cumulativeRewardPerToken();
        uint256 rewardsRateSinceLastUpdate = ((cumulativeRewardPerToken -
            lastCumulativeRewardPerToken) * lastEthGlpPrice) / GLP_PRECISION; // GLP_PRECISION

        // compute index using rate increase & last index
        resultRay =
            (lastIndexRay * (GLP_PRECISION + rewardsRateSinceLastUpdate)) /
            GLP_PRECISION;

        if (resultRay == 0) {
            revert CustomErrors
                .GlpRewardTrackerCumulativeRewardPerTokenReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
