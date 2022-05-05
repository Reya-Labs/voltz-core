// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ICompoundRateOracle.sol";
import "../interfaces/compound/ICToken.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WadRayMath.sol";
import "../rate_oracles/BaseRateOracle.sol";

contract CompoundRateOracle is BaseRateOracle, ICompoundRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    /// @inheritdoc ICompoundRateOracle
    ICToken public override ctoken;

    /// @inheritdoc ICompoundRateOracle
    uint256 public override decimals;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 2; // id of compound is 2

    constructor(
        ICToken _ctoken,
        IERC20Minimal underlying,
        uint8 _decimals,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(underlying) {
        ctoken = _ctoken;
        require(
            ctoken.underlying() == address(underlying),
            "Tokens do not match"
        );
        decimals = _decimals;

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
        times[length] = Time.blockTimestampTruncated();
        results[length] = exchangeRateInRay();
        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext,
            oracleVars.rateIndex
        ) = observations.initialize(times, results);
    }

    function exchangeRateInRay() internal view returns (uint256 resultRay) {
        uint256 exchangeRateStored = ctoken.exchangeRateStored();
        if (exchangeRateStored == 0) {
            revert CustomErrors.CTokenExchangeRateReturnedZero();
        }

        // cToken exchangeRateStored() returns the current exchange rate as an unsigned integer, scaled by 1 * 10^(10 + Underlying Token Decimals)
        // source: https://compound.finance/docs/ctokens#exchange-rate and https://compound.finance/docs#protocol-math
        // We want the same number scaled by 10^27 (ray)
        // So: if Underlying Token Decimals == 17, no scaling is required
        //     if Underlying Token Decimals > 17, we scale down by a factor of 10^difference
        //     if Underlying Token Decimals < 17, we scale up by a factor of 10^difference
        if (decimals >= 17) {
            uint256 scalingFactor = 10**(decimals - 17);
            resultRay = exchangeRateStored / scalingFactor;
        } else {
            uint256 scalingFactor = 10**(17 - decimals);
            resultRay = exchangeRateStored * scalingFactor;
        }

        return resultRay;
    }

    /// @notice Store the CToken's current exchange rate, in Ray
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

        uint256 resultRay = exchangeRateInRay();

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

        // note that we have to convert comp index into "floating rate" for
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
                rateValueRay = exchangeRateInRay();
            } else {
                rateValueRay = rate.observedValue;
            }
            return rateValueRay;
        }

        uint256 currentValueRay = exchangeRateInRay();
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
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }
}
