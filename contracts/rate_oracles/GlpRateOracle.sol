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

        _populateObservationsWithOnlyTrustedPoints(_times, _results);
    }

    function _populateObservationsWithOnlyTrustedPoints(
        uint32[] memory _times,
        uint256[] memory _results
    ) internal {
        // If we're using even half the max buffer size, something has gone wrong
        require(_times.length < OracleBuffer.MAX_BUFFER_LENGTH / 2, "MAXT");
        uint16 length = uint16(_times.length);
        require(length == _results.length, "Lengths must match");

        // This oracle needs initial trusted points
        require(length > 0, "Missing initial observations");

        // We must pass equal-sized dynamic arrays containing initial timestamps
        uint32[] memory times = new uint32[](length);
        uint256[] memory results = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            times[i] = _times[i];
            results[i] = _results[i];
        }

        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext,
            oracleVars.rateIndex
        ) = observations.initialize(times, results);
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
        IRewardDistributor distributor = IRewardDistributor(
            rewardTracker.distributor()
        );
        IGlpManager glpManager = IGlpManager(rewardRouter.glpManager());
        IVault vault = glpManager.vault();

        // calculate apy cince last update
        uint256 tokensPerInterval = distributor.tokensPerInterval();
        uint256 glpPoolAum = glpManager.getAum(false); // 30 decimals precision
        uint256 ethPrice = vault.getMinPrice(distributor.rewardToken()); // 30 decimals precision

        uint256 timeSinceLastUpdate = block.timestamp - uint256(lastTimestamp);
        uint256 tokensSinceLastUpdate = tokensPerInterval * timeSinceLastUpdate;
        uint256 apySinceLastUpdateWad = (tokensSinceLastUpdate * ethPrice) /
            glpPoolAum;

        // compute index from apy
        resultRay = (lastIndexRay * apySinceLastUpdateWad) / 1e18;

        if (resultRay == 0) {
            revert CustomErrors
                .GlpRewardTrackerCumulativeRewardPerTokenReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
