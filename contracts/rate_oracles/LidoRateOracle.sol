// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ILidoRateOracle.sol";
import "../interfaces/lido/IStETH.sol";
import "../interfaces/lido/ILidoOracle.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "../utils/WadRayMath.sol";

contract LidoRateOracle is BaseRateOracle, ILidoRateOracle {
    IStETH public override stEth;
    ILidoOracle public override lidoOracle;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 3; // id of Lido is 3

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

        // slope in ray
        uint256 slope = (postTotalPooledEther * WadRayMath.RAY) /
            preTotalPooledEther;

        // time since last update in ray
        // solhint-disable-next-line not-rely-on-time
        uint256 timeSinceLastUpdate = ((block.timestamp - frameStartTime) *
            WadRayMath.RAY) / timeElapsed;

        // compute the rate in ray
        resultRay =
            ((postTotalPooledEther - preTotalPooledEther) *
                timeSinceLastUpdate) /
            WadRayMath.RAY +
            lastUpdatedRate;

        return resultRay;
    }

    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {
        OracleBuffer.Observation memory last = observations[index];

        // early return (to increase ttl of data in the observations buffer) if we've already written an observation recently
        if (blockTimestamp - minSecondsSinceLastUpdate < last.blockTimestamp)
            return (index, cardinality);

        (, uint256 frameStartTime, ) = lidoOracle.getCurrentFrame();
        uint256 resultRay = stEth.getPooledEthByShares(WadRayMath.RAY);

        emit OracleBufferUpdate(
            Time.blockTimestampScaled(),
            address(this),
            index,
            blockTimestamp,
            resultRay,
            cardinality,
            cardinalityNext
        );

        return
            observations.write(
                index,
                frameStartTime,
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
