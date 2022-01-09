// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "hardhat/console.sol";

contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {
    using SafeMath for uint256;
    using OracleBuffer for OracleBuffer.Observation[65535];

    /// @dev getReserveNormalizedIncome() returned zero for underlying asset. Oracle only supports active Aave-V2 assets.
    error AavePoolGetReserveNormalizedIncomeReturnedZero();

    /// @inheritdoc IAaveRateOracle
    address public override aaveLendingPool;

    constructor(
        address _aaveLendingPool,
        address underlying,
        address factory
    ) BaseRateOracle(underlying, factory) {
        aaveLendingPool = _aaveLendingPool;
        uint32 blockTimestamp = Time.blockTimestampTruncated();
        uint256 result = IAaveV2LendingPool(aaveLendingPool)
            .getReserveNormalizedIncome(underlying);

        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        ) = observations.initialize(blockTimestamp, result);
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @param index The index of the Observation that was most recently written to the observations buffer
    /// @param cardinality The number of populated elements in the observations buffer
    /// @param cardinalityNext The new length of the observations buffer, independent of population
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {
        OracleBuffer.Observation memory last = observations[index];
        uint32 blockTimestamp = Time.blockTimestampTruncated();

        // early return (to increase ttl of data in the observations buffer) if we've already written an observation recently
        if (blockTimestamp - minSecondsSinceLastUpdate < last.blockTimestamp)
            return (index, cardinality);

        uint256 result = IAaveV2LendingPool(aaveLendingPool)
            .getReserveNormalizedIncome(underlying);
        if (result == 0) {
            revert AavePoolGetReserveNormalizedIncomeReturnedZero();
        }

        return
            observations.write(
                index,
                blockTimestamp,
                result,
                cardinality,
                cardinalityNext
            );
    }

    /// @notice Calculates the observed interest returned by the underlying in a given period
    /// @dev Reverts if we have no data point for either timestamp
    /// @param _from The timestamp of the start of the period, in seconds
    /// @param _to The timestamp of the end of the period, in seconds
    /// @return The "floating rate" expressed in Ray, e.g. 4% is encoded as 0.04*10**27 = 4*10*25
    function getRateFromTo(
        uint256 _from,
        uint256 _to // @audit - move docs to IRateOracle. Add additional parameter to use cache and implement cache.
    ) public view override(BaseRateOracle, IRateOracle) returns (uint256) {
        if (_from == _to) {
            return 0;
        }

        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25
        uint32 currentTime = Time.blockTimestampTruncated();
        uint32 from = Time.timestampAsUint32(_from);
        uint32 to = Time.timestampAsUint32(_to);

        uint256 rateFrom = observeSingle(
            currentTime,
            from,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );
        uint256 rateTo = observeSingle(
            currentTime,
            to,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );

        if (rateTo > rateFrom) {
            return
                WadRayMath.rayToWad(
                    WadRayMath.rayDiv(rateTo, rateFrom).sub(WadRayMath.RAY)
                );
        } else {
            return 0;
        }
    }

    /// @notice Calculates the interpolated (counterfactual) rate value
    /// @param beforeOrAtRateValue  Rate Value (in ray) before the timestamp for which we want to calculate the counterfactual rate value
    /// @param apyFromBeforeOrAtToAtOrAfter Apy in the period between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @param timeDeltaBeforeOrAtToQueriedTime Time Delta (in wei seconds) between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @return rateValue Counterfactual (interpolated) rate value in ray
    /// @dev Given [beforeOrAt, atOrAfter] where the timestamp for which the counterfactual is calculated is within that range (but does not touch any of the bounds)
    /// @dev We can calculate the apy for [beforeOrAt, atOrAfter] --> refer to this value as apyFromBeforeOrAtToAtOrAfter
    /// @dev Then we want a counterfactual rate value which results in apy_before_after if the apy is calculated between [beforeOrAt, timestampForCounterfactual]
    /// @dev Hence (1+rateValueWei/beforeOrAtRateValueWei)^(1/timeInYears) = apyFromBeforeOrAtToAtOrAfter
    /// @dev Hence rateValueWei = beforeOrAtRateValueWei * (1+apyFromBeforeOrAtToAtOrAfter)^timeInYears - 1)
    function interpolateRateValue(
        uint256 beforeOrAtRateValue,
        uint256 apyFromBeforeOrAtToAtOrAfter,
        uint256 timeDeltaBeforeOrAtToQueriedTime
    ) internal pure returns (uint256 rateValue) {
        uint256 timeInYears = FixedAndVariableMath.accrualFact(
            timeDeltaBeforeOrAtToQueriedTime
        );
        uint256 exp1 = PRBMathUD60x18.pow(
            (ONE_WEI + apyFromBeforeOrAtToAtOrAfter),
            timeInYears
        ) - ONE_WEI;

        uint256 beforeOrAtRateValueWei = WadRayMath.rayToWad(
            beforeOrAtRateValue
        );
        uint256 rateValueWei = PRBMathUD60x18.mul(beforeOrAtRateValueWei, exp1);
        rateValue = WadRayMath.wadToRay(rateValueWei);
    }

    function observeSingle(
        uint32 currentTime, // @audit not sure why this is a param. Perhaps for gas efficiency to save us gettign the timestamp multiple times? Probably makes more sense if it's an internal function.
        uint32 queriedTime,
        uint16 index, // @audit again, probably makes more sense for an internal function. For external we should look this up ratehr than trust the input.
        uint16 cardinality // @audit again, probably makes more sense for an internal function. For external we should look this up ratehr than trust the input. // @audit could this be internal?
    ) internal view returns (uint256 rateValue) {
        require(currentTime >= queriedTime, "OOO");

        if (currentTime == queriedTime) {
            OracleBuffer.Observation memory rate;
            rate = observations[index];
            if (rate.blockTimestamp != currentTime) {
                // @audit I can have this function return the current liquidity index for any value of `queriedTime`, by passing `currentTime` = `queriedTime`. Even if this function were internal we should document that more clearly, but if the function must be public that feels like dangerous behaviour.
                rateValue = IAaveV2LendingPool(aaveLendingPool)
                    .getReserveNormalizedIncome(underlying);
            } else {
                rateValue = rate.observedValue;
            }
            return rateValue;
        }

        uint256 currentValue = IAaveV2LendingPool(aaveLendingPool)
            .getReserveNormalizedIncome(underlying);
        (
            OracleBuffer.Observation memory beforeOrAt,
            OracleBuffer.Observation memory atOrAfter
        ) = observations.getSurroundingObservations(
                currentTime,
                queriedTime,
                currentValue,
                index,
                cardinality
            );

        if (queriedTime == beforeOrAt.blockTimestamp) {
            // we are at the left boundary
            rateValue = beforeOrAt.observedValue;
        } else if (queriedTime == atOrAfter.blockTimestamp) {
            // we are at the right boundary
            rateValue = atOrAfter.observedValue;
        } else {
            // we are in the middle
            // find apy between beforeOrAt and atOrAfter

            uint256 rateFromBeforeOrAtToAtOrAfter;

            if (atOrAfter.observedValue > beforeOrAt.observedValue) {
                rateFromBeforeOrAtToAtOrAfter = WadRayMath
                    .rayDiv(atOrAfter.observedValue, beforeOrAt.observedValue)
                    .sub(WadRayMath.RAY); // @audit - why do we take away 1? Looks like it's more useful to the functions below if we keep 5% = 1.05 rather than 5% = 0.05?
                // @audit - more generally, what should our terminology be to distinguish cases where we represetn a 5% APY as = 1.05 vs. 0.05? We should pick a clear terminology and be use it throughout our descriptions / Hungarian notation / user defined types.
            }

            uint256 timeInYears = FixedAndVariableMath.accrualFact(
                (atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp) *
                    WadRayMath.wad()
            );
            uint256 apyFromBeforeOrAtToAtOrAfter = computeApyFromRate(
                rateFromBeforeOrAtToAtOrAfter,
                timeInYears
            );

            // interpolate rateValue for queriedTime
            rateValue = interpolateRateValue(
                beforeOrAt.observedValue,
                apyFromBeforeOrAtToAtOrAfter,
                (queriedTime - beforeOrAt.blockTimestamp) * WadRayMath.wad()
            );
        }
    }

    function writeOracleEntry() external override(BaseRateOracle, IRateOracle) {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }
}
