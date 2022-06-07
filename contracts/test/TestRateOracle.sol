// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/AaveRateOracle.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../utils/WadRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";

contract TestRateOracle is AaveRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(IAaveV2LendingPool aaveLendingPool, IERC20Minimal underlying)
        AaveRateOracle(
            aaveLendingPool,
            underlying,
            new uint32[](0),
            new uint256[](0)
        )
    {}

    function getRate(uint16 index) external view returns (uint256, uint256) {
        OracleBuffer.Observation memory rate = observations[index];
        return (rate.blockTimestamp, rate.observedValue);
    }

    function binarySearch(uint32 target)
        external
        view
        returns (
            OracleBuffer.Observation memory beforeOrAt,
            OracleBuffer.Observation memory atOrAfter
        )
    {
        return
            observations.binarySearch(
                target,
                oracleVars.rateIndex,
                oracleVars.rateCardinality
            );
    }

    function testGetSurroundingRates(uint32 target)
        external
        view
        returns (
            uint256 latestBeforeOrAtRateValue,
            uint256 latestAfterOrAtRateValue
        )
    {
        uint256 currentValue = getCurrentRateInRay();
        (
            OracleBuffer.Observation memory beforeOrAt,
            OracleBuffer.Observation memory atOrAfter
        ) = observations.getSurroundingObservations(
                target,
                Time.blockTimestampTruncated(),
                currentValue,
                oracleVars.rateIndex,
                oracleVars.rateCardinality
            );

        latestBeforeOrAtRateValue = beforeOrAt.observedValue;
        latestAfterOrAtRateValue = atOrAfter.observedValue;
    }

    // Expose internal function
    function testComputeApyFromRate(uint256 rateFromTo, uint256 timeInYears)
        external
        pure
        returns (uint256)
    {
        return computeApyFromRate(rateFromTo, timeInYears);
    }

    // Checks that the observed value is within 0.0000001% of the expected value
    function rayValueIsCloseTo(
        uint256 observedValueInRay,
        uint256 expectedValueInRay
    ) external pure returns (bool) {
        uint256 upperBoundFactor = 1000000001 * 1e18;
        uint256 lowerBoundFactor = 999999999 * 1e18;
        uint256 upperBound = WadRayMath.rayMul(
            expectedValueInRay,
            upperBoundFactor
        );
        uint256 lowerBound = WadRayMath.rayMul(
            expectedValueInRay,
            lowerBoundFactor
        );
        // console.log('%s <= %s <= %s ??', lowerBound,observedValueInRay, upperBound);
        if (
            observedValueInRay <= upperBound && observedValueInRay >= lowerBound
        ) {
            return true;
        } else {
            return false;
        }
    }
}
