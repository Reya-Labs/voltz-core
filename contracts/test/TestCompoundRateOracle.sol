pragma solidity ^0.8.0;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/CompoundRateOracle.sol";
import "../interfaces/rate_oracles/ICompoundRateOracle.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/WadRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/compound/ICToken.sol";

contract TestCompoundRateOracle is CompoundRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    int24 public tick;
    uint128 public liquidity;

    uint256 public latestObservedRateValue;
    uint256 public latestRateFromTo;

    uint256 public latestBeforeOrAtRateValue;
    uint256 public latestAfterOrAtRateValue;

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(
        ICToken cToken,
        IERC20Minimal underlying,
        uint8 _decimals
    )
        CompoundRateOracle(
            cToken,
            underlying,
            _decimals,
            new uint32[](0),
            new uint256[](0)
        )
    {}

    function getOracleVars()
        external
        view
        returns (
            uint16,
            uint16,
            uint16
        )
    {
        return (
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }

    function getRate(uint16 index) external view returns (uint256, uint256) {
        OracleBuffer.Observation memory rate = observations[index];
        return (rate.blockTimestamp, rate.observedValue);
    }

    function testObserveSingle(uint32 queriedTime)
        external
        returns (uint256 observedValue)
    {
        latestObservedRateValue = observeSingle(
            Time.blockTimestampTruncated(),
            queriedTime,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );
        return latestObservedRateValue;
    }

    function testGrow(uint16 _rateCardinalityNext) external {
        oracleVars.rateCardinalityNext = observations.grow(
            oracleVars.rateCardinalityNext,
            _rateCardinalityNext
        );
    }

    function testGetRateFromTo(uint256 from, uint256 to)
        external
        returns (uint256)
    {
        latestRateFromTo = getRateFromTo(from, to);
        return latestRateFromTo;
    }

    // function testBinarySearch(uint32 target)
    //     external
    //     view
    //     returns (uint256 beforeOrAtRateValue, uint256 afterOrAtRateValue)
    // {
    //     (OracleBuffer.Observation memory beforeOrAt, OracleBuffer.Observation memory atOrAfter) = observations.binarySearch(
    //         Time.blockTimestampTruncated(),
    //         target,
    //         oracleVars.rateIndex,
    //         oracleVars.rateCardinality
    //     );
    //     beforeOrAtRateValue = beforeOrAt.observedValue;
    //     afterOrAtRateValue = atOrAfter.observedValue;
    // }
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

    // function testGetSurroundingRates(uint32 target) external {
    //     uint256 currentValue = ICToken(ctoken).exchangeRateCurrent();
    //     (
    //         OracleBuffer.Observation memory beforeOrAt,
    //         OracleBuffer.Observation memory atOrAfter
    //     ) = observations.getSurroundingObservations(
    //             target,
    //             currentValue,
    //             oracleVars.rateIndex,
    //             oracleVars.rateCardinality
    //         );

    //     latestBeforeOrAtRateValue = beforeOrAt.observedValue;
    //     latestAfterOrAtRateValue = atOrAfter.observedValue;
    // }

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
