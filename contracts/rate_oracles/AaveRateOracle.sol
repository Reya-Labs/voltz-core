// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WadRayMath.sol";
import "../rate_oracles/BaseRateOracle.sol";

contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    /// @inheritdoc IAaveRateOracle
    IAaveV2LendingPool public override aaveLendingPool;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 1; // id of aave v2 is 1

    uint256 public constant ONE_IN_WAD = 1e18;

    constructor(IAaveV2LendingPool _aaveLendingPool, IERC20Minimal _underlying)
        BaseRateOracle(_underlying)
    {
        require(
            address(_aaveLendingPool) != address(0),
            "aave pool must exist"
        );
        require(address(_underlying) != address(0), "underlying must exist");

        aaveLendingPool = _aaveLendingPool;
        uint32 blockTimestamp = Time.blockTimestampTruncated();
        uint256 result = aaveLendingPool.getReserveNormalizedIncome(
            _underlying
        );

        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        ) = observations.initialize(blockTimestamp, result);
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @param index The index of the Observation that was most recently written to the observations buffer
    /// @param cardinality The number of populated elements in the observations buffer
    /// @param cardinalityNext The new length of the observations buffer, independent of population
    /// @return indexUpdated The new index of the most recently written element in the oracle array
    /// @return cardinalityUpdated The new cardinality of the oracle array
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

        uint256 resultRay = aaveLendingPool.getReserveNormalizedIncome(
            underlying
        );
        if (resultRay == 0) {
            revert CustomErrors.AavePoolGetReserveNormalizedIncomeReturnedZero();
        }

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
                blockTimestamp,
                resultRay,
                cardinality,
                cardinalityNext
            );
    }

    /// @notice Calculates the observed interest returned by the underlying in a given period
    /// @dev Reverts if we have no data point for either timestamp
    /// @param _from The timestamp of the start of the period, in seconds
    /// @param _to The timestamp of the end of the period, in seconds
    /// @return The "floating rate" expressed in Wad, e.g. 4% is encoded as 0.04*10**18 = 4*10**16
    function getRateFromTo(
        uint256 _from,
        uint256 _to //  move docs to IRateOracle. Add additional parameter to use cache and implement cache.
    ) public view override(BaseRateOracle, IRateOracle) returns (uint256) {
        require(_from <= _to, "from > to");

        if (_from == _to) {
            return 0;
        }

        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25
        uint32 currentTime = Time.blockTimestampTruncated();
        uint32 from = Time.timestampAsUint32(_from);
        uint32 to = Time.timestampAsUint32(_to);

        uint256 rateFromRay = observeSingle(
            currentTime,
            from,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );
        uint256 rateToRay = observeSingle(
            currentTime,
            to,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );

        if (rateToRay > rateFromRay) {
            uint256 result = WadRayMath.rayToWad(
                WadRayMath.rayDiv(rateToRay, rateFromRay) - WadRayMath.RAY
            );
            return result;
        } else {
            return 0;
        }
    }

    /// @notice Calculates the interpolated (counterfactual) rate value
    /// @param beforeOrAtRateValueRay  Rate Value (in ray) before the timestamp for which we want to calculate the counterfactual rate value
    /// @param apyFromBeforeOrAtToAtOrAfterWad Apy in the period between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @param timeDeltaBeforeOrAtToQueriedTimeWad Time Delta (in wei seconds) between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @return rateValueRay Counterfactual (interpolated) rate value in ray
    /// @dev Given [beforeOrAt, atOrAfter] where the timestamp for which the counterfactual is calculated is within that range (but does not touch any of the bounds)
    /// @dev We can calculate the apy for [beforeOrAt, atOrAfter] --> refer to this value as apyFromBeforeOrAtToAtOrAfter
    /// @dev Then we want a counterfactual rate value which results in apy_before_after if the apy is calculated between [beforeOrAt, timestampForCounterfactual]
    /// @dev Hence (1+rateValueWei/beforeOrAtRateValueWei)^(1/timeInYears) = apyFromBeforeOrAtToAtOrAfter
    /// @dev Hence rateValueWei = beforeOrAtRateValueWei * (1+apyFromBeforeOrAtToAtOrAfter)^timeInYears - 1)
    function interpolateRateValue(
        uint256 beforeOrAtRateValueRay,
        uint256 apyFromBeforeOrAtToAtOrAfterWad,
        uint256 timeDeltaBeforeOrAtToQueriedTimeWad
    ) public pure returns (uint256 rateValueRay) {
        uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
            timeDeltaBeforeOrAtToQueriedTimeWad
        );
        uint256 apyPlusOne = apyFromBeforeOrAtToAtOrAfterWad + ONE_IN_WAD;
        uint256 factorInWad = PRBMathUD60x18.pow(apyPlusOne, timeInYearsWad);
        uint256 factorInRay = WadRayMath.wadToRay(factorInWad);
        rateValueRay = WadRayMath.rayMul(beforeOrAtRateValueRay, factorInRay);
    }

    function observeSingle(
        uint32 currentTime,
        uint32 queriedTime,
        uint16 index,
        uint16 cardinality
    ) internal view returns (uint256 rateValueRay) {
        if (currentTime < queriedTime) revert CustomErrors.OOO();

        if (currentTime == queriedTime) {
            OracleBuffer.Observation memory rate;
            rate = observations[index];
            if (rate.blockTimestamp != currentTime) {
                rateValueRay = aaveLendingPool.getReserveNormalizedIncome(
                    underlying
                );
            } else {
                rateValueRay = rate.observedValue;
            }
            return rateValueRay;
        }

        uint256 currentValueRay = aaveLendingPool.getReserveNormalizedIncome(
            underlying
        );
        (
            OracleBuffer.Observation memory beforeOrAt,
            OracleBuffer.Observation memory atOrAfter
        ) = observations.getSurroundingObservations(
                queriedTime,
                currentTime,
                currentValueRay,
                index,
                cardinality
            );

        if (queriedTime == beforeOrAt.blockTimestamp) {
            // we are at the left boundary
            rateValueRay = beforeOrAt.observedValue;
        } else if (queriedTime == atOrAfter.blockTimestamp) {
            // we are at the right boundary
            rateValueRay = atOrAfter.observedValue;
        } else {
            // we are in the middle
            // find apy between beforeOrAt and atOrAfter

            uint256 rateFromBeforeOrAtToAtOrAfterWad;

            // more generally, what should our terminology be to distinguish cases where we represetn a 5% APY as = 1.05 vs. 0.05? We should pick a clear terminology and be use it throughout our descriptions / Hungarian notation / user defined types.

            if (atOrAfter.observedValue > beforeOrAt.observedValue) {
                uint256 rateFromBeforeOrAtToAtOrAfterRay = WadRayMath.rayDiv(
                    atOrAfter.observedValue,
                    beforeOrAt.observedValue
                ) - WadRayMath.RAY;

                rateFromBeforeOrAtToAtOrAfterWad = WadRayMath.rayToWad(
                    rateFromBeforeOrAtToAtOrAfterRay
                );
            }

            uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
                (atOrAfter.blockTimestamp - beforeOrAt.blockTimestamp) *
                    WadRayMath.wad()
            );

            uint256 apyFromBeforeOrAtToAtOrAfterWad = computeApyFromRate(
                rateFromBeforeOrAtToAtOrAfterWad,
                timeInYearsWad
            );

            // interpolate rateValue for queriedTime
            rateValueRay = interpolateRateValue(
                beforeOrAt.observedValue,
                apyFromBeforeOrAtToAtOrAfterWad,
                (queriedTime - beforeOrAt.blockTimestamp) * WadRayMath.wad()
            );
        }
    }

    function writeOracleEntry() external override(BaseRateOracle, IRateOracle) {
        // In the case of Aave, the values we write are obtained by calling aaveLendingPool.getReserveNormalizedIncome(underlying)
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }
}
