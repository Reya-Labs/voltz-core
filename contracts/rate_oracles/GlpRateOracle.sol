// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IGlpRateOracle.sol";
import "../interfaces/glp/IRewardTracker.sol";
import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IRewardDistributor.sol";
import "../interfaces/glp/IRewardRouter.sol";
import "../interfaces/glp/IGlpManager.sol";
import "../rate_oracles/BaseRateOracle.sol";

contract GlpRateOracle is BaseRateOracle, IGlpRateOracle {
    /// @inheritdoc IGlpRateOracle
    IRewardRouter public override rewardRouter;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 8;

    constructor(
        IRewardRouter _rewardRouter,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(_underlying) {
        require(
            address(_rewardRouter) != address(0),
            "GLP reward racker must exist"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        rewardRouter = _rewardRouter;

        _populateInitialObservations(_times, _results);
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        OracleBuffer.Observation memory last = observations[oracleVars.rateIndex];
        uint32 lastTimestamp = last.blockTimestamp;
        uint216 lastIndexRay = last.observedValue;

        IRewardTracker rewardTracker = IRewardTracker(rewardRouter.feeGlpTracker());
        IRewardDistributor distributor = IRewardDistributor(rewardTracker.distributor());
        IGlpManager glpManager = IGlpManager(rewardRouter.glpManager());
        IVault vault = glpManager.vault();

        uint256 tokensPerInterval = distributor.tokensPerInterval();
        uint256 glpPoolAum = glpManager.getAum(false); // 30 decimals precision
        uint256 ethPrice = vault.getMinPrice(distributor.rewardToken()); // 30 decimals precision


        uint256 timeSinceLastUpdate = block.timestamp - uint256(lastTimestamp);
        uint256 apySinceLastUpdateWad = (tokensPerInterval * timeSinceLastUpdate) /
            (glpPoolAum / ethPrice);

        resultRay = (lastIndexRay * apySinceLastUpdateWad) / 1e18;

        if (resultRay == 0) {
            revert CustomErrors
                .GlpRewardTrackerCumulativeRewardPerTokenReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
