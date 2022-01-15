pragma solidity ^0.8.0;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/AaveRateOracle.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/WayRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";

contract TestRateOracle is AaveRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    int24 public tick;
    uint128 public liquidity;

    uint256 public latestObservedRateValue;
    uint256 public latestRateFromTo;

    uint256 public latestBeforeOrAtRateValue;
    uint256 public latestAfterOrAtRateValue;

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(address aaveLendingPool, address underlying)
        AaveRateOracle(aaveLendingPool, underlying)
    {
        // if not done manually, doesn't work for some reason
        aaveLendingPool = aaveLendingPool;
        underlying = underlying;

        // console.log("Test Contract: Aave lending pool address is: ", aaveLendingPool);
        // console.log("Test Contract: Underlying is: ", underlying);
    }

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

    function testGrow(uint16 _rateCardinalityNext) external {
        oracleVars.rateCardinalityNext = observations.grow(
            oracleVars.rateCardinalityNext,
            _rateCardinalityNext
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

    function testGetRateFromTo(uint256 from, uint256 to)
        external
        returns (uint256)
    {
        latestRateFromTo = getRateFromTo(from, to);
        return latestRateFromTo;
    }

    function testInterpolateRateValue(
        uint256 beforeOrAtRateValue,
        uint256 apyFromBeforeOrAtToAtOrAfter,
        uint256 timeDeltaBeforeOrAtToQueriedTime
    ) external pure returns (uint256) {
        return
            interpolateRateValue(
                beforeOrAtRateValue,
                apyFromBeforeOrAtToAtOrAfter,
                timeDeltaBeforeOrAtToQueriedTime
            );
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

    function testGetSurroundingRates(uint32 target) external {
        uint256 currentValue = IAaveV2LendingPool(aaveLendingPool)
            .getReserveNormalizedIncome(underlying);
        (
            OracleBuffer.Observation memory beforeOrAt,
            OracleBuffer.Observation memory atOrAfter
        ) = observations.getSurroundingObservations(
                target,
                currentValue,
                oracleVars.rateIndex,
                oracleVars.rateCardinality
            );

        latestBeforeOrAtRateValue = beforeOrAt.observedValue;
        latestAfterOrAtRateValue = atOrAfter.observedValue;
    }

    function testComputeApyFromRate(uint256 rateFromTo, uint256 timeInYears)
        external
        pure
        returns (uint256)
    {
        return computeApyFromRate(rateFromTo, timeInYears);
    }
}
