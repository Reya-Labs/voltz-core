// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IGlpRateOracle.sol";
import "../interfaces/glp/IRewardTracker.sol";
import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IRewardRouter.sol";
import "../interfaces/glp/IGlpManager.sol";
import "../rate_oracles/BaseRateOracle.sol";

contract GlpRateOracle is BaseRateOracle, IGlpRateOracle {
    /// @inheritdoc IGlpRateOracle
    IRewardRouter public override rewardRouter;
    using OracleBuffer for OracleBuffer.Observation[65535];

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 8;

    constructor(
        IRewardRouter _rewardRouter,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(_underlying) {
        require(
            address(_rewardRouter) != address(0),
            "GLP reward router must exist"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        rewardRouter = _rewardRouter;

        _populateInitialObservationsCustom(_times, _results, false);
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        // get last observation
        OracleBuffer.Observation memory last = observations[
            oracleVars.rateIndex
        ];
        uint32 lastTimestamp = last.blockTimestamp;
        uint216 lastIndexRay = last.observedValue;
        require(lastIndexRay > 0, "No previous observation");

        // all required contracts
        IRewardTracker rewardTracker = IRewardTracker(
            rewardRouter.feeGlpTracker()
        );
        IGlpManager glpManager = IGlpManager(rewardRouter.glpManager());
        IVault vault = glpManager.vault();

        // calculate rate increase since last update
        uint256 ethWadDistributedPerSecond = rewardTracker.tokensPerInterval();
        uint256 glpPoolAum = glpManager.getAum(false); // 30 decimals precision
        uint256 ethPrice = vault.getMinPrice(rewardTracker.rewardToken()); // 30 decimals precision

        uint256 timeSinceLastUpdate = block.timestamp - uint256(lastTimestamp);
        uint256 ethWadSinceLastUpdate = ethWadDistributedPerSecond *
            timeSinceLastUpdate;
        uint256 rateIncreaseFactor = (ethWadSinceLastUpdate * ethPrice) /
            glpPoolAum;

        // compute index using rate increase & last index
        resultRay = (lastIndexRay * rateIncreaseFactor) / 1e18;

        if (resultRay == 0) {
            revert CustomErrors
                .GlpRewardTrackerCumulativeRewardPerTokenReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
