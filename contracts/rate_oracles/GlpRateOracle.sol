// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "../utils/FullMath.sol";
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

    uint256 public lastEthPriceInGlp;
    uint256 public lastCumulativeRewardPerToken;

    IGlpManager public glpManager;
    IVault public vault;
    IRewardTracker public rewardTracker;
    IERC20 public glp;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 8;

    constructor(
        IRewardRouter _rewardRouter,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results,
        uint256 _lastEthPriceInGlp,
        uint256 _lastCumulativeRewardPerToken
    ) BaseRateOracle(_underlying) {
        require(
            address(_rewardRouter) != address(0),
            "GLP reward router must exist"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        rewardRouter = _rewardRouter;

        refreashRewardContracts();

        _populateInitialObservations(_times, _results, false);

        require(_lastEthPriceInGlp > 0, "Price cannot be 0");
        lastEthPriceInGlp = _lastEthPriceInGlp;
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

    /// Used to refreash contracts dependencies in case of a GMX update
    function refreashRewardContracts() public {
        glpManager = IGlpManager(rewardRouter.glpManager());
        vault = glpManager.vault();
        rewardTracker = IRewardTracker(rewardRouter.feeGlpTracker());
        glp = IERC20(glpManager.glp());
    }

    /// @dev must be called after every write to the oracle buffer
    function pupulateLastGlpData() internal {
        // average over min & max price of GLP price feeds
        // see https://github.com/gmx-io/gmx-contracts/blob/master/contracts/core/VaultPriceFeed.sol
        address rewardToken = rewardTracker.rewardToken();
        require(
            rewardToken == address(underlying),
            "Reward token isn't underlying"
        );

        uint256 ethPriceMinInUsd = vault.getMinPrice(rewardToken); // 30 decimals precision
        uint256 ethPriceMaxInUsd = vault.getMaxPrice(rewardToken);
        uint256 glpSupply = glp.totalSupply();
        uint256 glpPriceMinInUsd = FullMath.mulDiv(
            glpManager.getAum(false),
            1e18,
            glpSupply
        ); // min price
        uint256 glpPriceMaxInUsd = FullMath.mulDiv(
            glpManager.getAum(true),
            1e18,
            glpSupply
        ); // max price

        require(
            ethPriceMinInUsd + ethPriceMaxInUsd > 0 &&
                glpPriceMinInUsd + glpPriceMaxInUsd > 0,
            "Failed to get GLP price"
        );

        uint256 ethPriceInGlp = FullMath.mulDiv(
            ethPriceMinInUsd + ethPriceMaxInUsd,
            GLP_PRECISION,
            glpPriceMinInUsd + glpPriceMaxInUsd
        );
        lastEthPriceInGlp = ethPriceInGlp;

        uint256 currentReward = rewardTracker.cumulativeRewardPerToken();
        require(
            currentReward >= lastCumulativeRewardPerToken,
            "Unordered reward index"
        );
        lastCumulativeRewardPerToken = currentReward;
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

        // calculate rate increase since last update
        uint256 cumulativeRewardPerToken = rewardTracker
            .cumulativeRewardPerToken();
        uint256 rewardsRateSinceLastUpdate = FullMath.mulDiv(
            cumulativeRewardPerToken - lastCumulativeRewardPerToken,
            lastEthPriceInGlp,
            GLP_PRECISION
        ); // GLP_PRECISION

        // compute index using rate increase & last index
        resultRay = FullMath.mulDiv(
            GLP_PRECISION + rewardsRateSinceLastUpdate,
            lastIndexRay,
            GLP_PRECISION
        );

        if (resultRay == 0) {
            revert CustomErrors
                .GlpRewardTrackerCumulativeRewardPerTokenReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
