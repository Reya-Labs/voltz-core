// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ILidoRateOracle.sol";
import "../interfaces/lido/IStETH.sol";
import "../interfaces/lido/ILidoOracle.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "../utils/WadRayMath.sol";
import "./OracleBuffer.sol";
import "../core_libraries/Time.sol";

contract LidoRateOracle is BaseRateOracle, ILidoRateOracle {
    IStETH public override stEth;
    ILidoOracle public override lidoOracle;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 3; // id of Lido is 3

    uint256 public constant override RATE_VALUE_UPDATE_EPSILON = 1e10;

    using OracleBuffer for OracleBuffer.Observation[65535];

    constructor(
        IStETH _stEth,
        ILidoOracle _lidoOracle,
        IWETH _weth,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(IERC20Minimal(address(_weth))) {
        // Underlying is ETH, so no address needed
        require(address(_stEth) != address(0), "stETH must exist");
        require(address(_lidoOracle) != address(0), "lidoOracle must exist");
        stEth = _stEth;
        lidoOracle = _lidoOracle;

        _populateInitialObservations(_times, _results);
    }

    /// @dev this must be called at the *end* of the constructor, after the contract member variables have been set, because it needs to read rates.
    function _populateInitialObservations(
        uint32[] memory _times,
        uint256[] memory _results
    ) internal override {
        // If we're using even half the max buffer size, something has gone wrong
        require(_times.length < OracleBuffer.MAX_BUFFER_LENGTH / 2, "MAXT");
        uint16 length = uint16(_times.length);
        require(length == _results.length, "Lengths must match");

        // We must pass equal-sized dynamic arrays containing initial timestamps and observed values
        uint32[] memory times = new uint32[](length + 1);
        uint256[] memory results = new uint256[](length + 1);
        for (uint256 i = 0; i < length; i++) {
            times[i] = _times[i];
            results[i] = _results[i];
        }

        (, uint256 frameStartTime, ) = lidoOracle.getCurrentFrame();
        uint32 frameStartTimeTruncated = Time.timestampAsUint32(frameStartTime);
        uint256 resultRay = stEth.getPooledEthByShares(WadRayMath.RAY);

        times[length] = frameStartTimeTruncated;
        results[length] = resultRay;

        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext,
            oracleVars.rateIndex
        ) = observations.initialize(times, results);
    }

    /// @inheritdoc BaseRateOracle
    function getCurrentRateInRay()
        public
        view
        override
        returns (uint256 resultRay)
    {
        // We are taking advantage of the fact that Lido's implementation does not care about us passing in a
        // number of shares that is higher than the number of shared in existence.
        // The calculation that Lido does here would risk phantom overflow if Lido had > 10^50 ETH WEI staked
        // But that amount of ETH will never exist, so this is safe
        uint256 lastUpdatedRate = stEth.getPooledEthByShares(WadRayMath.RAY);
        if (lastUpdatedRate == 0) {
            revert CustomErrors.LidoGetPooledEthBySharesReturnedZero();
        }

        (
            uint256 postTotalPooledEther,
            uint256 preTotalPooledEther,
            uint256 timeElapsed
        ) = lidoOracle.getLastCompletedReportDelta();
        (, uint256 frameStartTime, ) = lidoOracle.getCurrentFrame();

        // time since last update in ray
        // solhint-disable-next-line not-rely-on-time
        uint256 timeSinceLastUpdate = ((block.timestamp - frameStartTime) *
            WadRayMath.RAY) / timeElapsed;

        // compute the rate in ray
        resultRay =
            ((postTotalPooledEther - preTotalPooledEther) *
                timeSinceLastUpdate) /
            preTotalPooledEther +
            lastUpdatedRate;

        return resultRay;
    }

    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    )
        internal
        override(BaseRateOracle)
        returns (uint16 indexUpdated, uint16 cardinalityUpdated)
    {
        OracleBuffer.Observation memory last = observations[index];

        (, uint256 frameStartTime, ) = lidoOracle.getCurrentFrame();
        uint32 frameStartTimeTruncated = Time.timestampAsUint32(frameStartTime);

        uint256 resultRay = stEth.getPooledEthByShares(WadRayMath.RAY);

        // early return (to increase ttl of data in the observations buffer) if we've already written an observation recently
        if (
            (frameStartTimeTruncated - minSecondsSinceLastUpdate <
                last.blockTimestamp) ||
            (resultRay < RATE_VALUE_UPDATE_EPSILON + last.observedValue)
        ) return (index, cardinality);

        emit OracleBufferUpdate(
            Time.blockTimestampScaled(),
            address(this),
            index,
            frameStartTimeTruncated,
            resultRay,
            cardinality,
            cardinalityNext
        );

        return
            observations.write(
                index,
                frameStartTimeTruncated,
                resultRay,
                cardinality,
                cardinalityNext
            );
    }

    /// @inheritdoc IRateOracle
    function getApyFromTo(uint256 from, uint256 to)
        public
        view
        override(IRateOracle, BaseRateOracle)
        returns (uint256 apyFromToWad)
    {
        uint256 raw = BaseRateOracle.getApyFromTo(from, to);
        uint256 fee = uint256(lidoOracle.getFee());

        return (raw * (10000 - fee)) / 10000;
    }

    /// @inheritdoc IRateOracle
    function variableFactor(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) public override(IRateOracle, BaseRateOracle) returns (uint256 resultWad) {
        uint256 raw = BaseRateOracle.variableFactor(
            termStartTimestampInWeiSeconds,
            termEndTimestampInWeiSeconds
        );
        uint256 fee = uint256(lidoOracle.getFee());

        return (raw * (10000 - fee)) / 10000;
    }

    /// @inheritdoc IRateOracle
    function variableFactorNoCache(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    )
        public
        view
        override(IRateOracle, BaseRateOracle)
        returns (uint256 resultWad)
    {
        uint256 raw = BaseRateOracle.variableFactorNoCache(
            termStartTimestampInWeiSeconds,
            termEndTimestampInWeiSeconds
        );
        uint256 fee = uint256(lidoOracle.getFee());

        return (raw * (10000 - fee)) / 10000;
    }
}
