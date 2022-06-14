// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core_libraries/Time.sol";
import "../utils/WadRayMath.sol";

/// @notice Common contract base for a Rate Oracle implementation.
///  This contract is abstract. To make the contract deployable override the
/// `getCurrentRateInRay` function and the UNDERLYING_YIELD_BEARING_PROTOCOL_ID constant.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions
abstract contract BaseRateOracle is IRateOracle, Ownable {
    uint256 public constant ONE_IN_WAD = 1e18;

    using OracleBuffer for OracleBuffer.Observation[65535];

    /// @notice a cache of settlement rates for interest rate swaps associated with this rate oracle, indexed by start time and then end time
    mapping(uint32 => mapping(uint32 => uint256)) public settlementRateCache;
    struct OracleVars {
        /// @dev the most-recently updated index of the rates array
        uint16 rateIndex;
        /// @dev the current maximum number of rates that are being stored
        uint16 rateCardinality;
        /// @dev the next maximum number of rates to store, triggered in rates.write
        uint16 rateCardinalityNext;
    }

    /// @inheritdoc IRateOracle
    IERC20Minimal public immutable override underlying;

    /// @inheritdoc IRateOracle
    uint256 public override minSecondsSinceLastUpdate;

    OracleVars public oracleVars;

    /// @notice the observations tracked over time by this oracle
    OracleBuffer.Observation[65535] public observations;

    /// @inheritdoc IRateOracle
    function setMinSecondsSinceLastUpdate(uint256 _minSecondsSinceLastUpdate)
        external
        override
        onlyOwner
    {
        if (minSecondsSinceLastUpdate != _minSecondsSinceLastUpdate) {
            minSecondsSinceLastUpdate = _minSecondsSinceLastUpdate;

            emit MinSecondsSinceLastUpdate(_minSecondsSinceLastUpdate);
        }
    }

    constructor(IERC20Minimal _underlying) {
        underlying = _underlying;
    }

    /// @dev this must be called at the *end* of the constructor, after the contract member variables have been set, because it needs to read rates.
    function _populateInitialObservations(
        uint32[] memory _times,
        uint256[] memory _results
    ) internal {
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
        results[length] = getCurrentRateInRay();
        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext,
            oracleVars.rateIndex
        ) = observations.initialize(times, results);
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
    ) public pure virtual returns (uint256 rateValueRay) {
        uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
            timeDeltaBeforeOrAtToQueriedTimeWad
        );
        uint256 apyPlusOne = apyFromBeforeOrAtToAtOrAfterWad + ONE_IN_WAD;
        uint256 factorInWad = PRBMathUD60x18.pow(apyPlusOne, timeInYearsWad);
        uint256 factorInRay = WadRayMath.wadToRay(factorInWad);
        rateValueRay = WadRayMath.rayMul(beforeOrAtRateValueRay, factorInRay);
    }

    /// @inheritdoc IRateOracle
    function increaseObservationCardinalityNext(uint16 rateCardinalityNext)
        external
        override
    {
        uint16 rateCardinalityNextOld = oracleVars.rateCardinalityNext; // for the event

        uint16 rateCardinalityNextNew = observations.grow(
            rateCardinalityNextOld,
            rateCardinalityNext
        );

        oracleVars.rateCardinalityNext = rateCardinalityNextNew;

        if (rateCardinalityNextOld != rateCardinalityNextNew) {
            emit RateCardinalityNext(rateCardinalityNextNew);
        }
    }

    /// @notice Get the current "rate" in Ray.
    /// The source, expected values, and semantics of "rate" may differ by rate oracle type. All that
    /// matters is that we can divide one "rate" by another "rate" to get the factor of growth between the two timestamps.
    /// For example if we have rates of { (t=0, rate=5), (t=100, rate=5.5) }, we can divide 5.5 by 5 to get a growth factor
    /// of 1.1, suggesting that 10% growth in capital was experienced between timesamp 0 and timestamp 100.
    /// @dev It is important that the rate is normalised to Ray for storage, so that we can perform consistent math across all rates.
    /// @dev This function should revert if a valid rate cannot be discerned
    /// @return the rate in Ray (decimal scaled up by 10^27 for storage in a uint256)
    function getCurrentRateInRay() public view virtual returns (uint256);

    /// @inheritdoc IRateOracle
    function getRateFromTo(uint256 _from, uint256 _to)
        public
        view
        override(IRateOracle)
        returns (uint256)
    {
        require(_from <= _to, "from > to");

        if (_from == _to) {
            return 0;
        }

        // note that we have to convert the rate multiple into a "floating rate" for
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
                rateValueRay = getCurrentRateInRay();
            } else {
                rateValueRay = rate.observedValue;
            }
            return rateValueRay;
        }

        uint256 currentValueRay = getCurrentRateInRay();
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
                    WadRayMath.WAD
            );

            uint256 apyFromBeforeOrAtToAtOrAfterWad = computeApyFromRate(
                rateFromBeforeOrAtToAtOrAfterWad,
                timeInYearsWad
            );

            // interpolate rateValue for queriedTime
            rateValueRay = interpolateRateValue(
                beforeOrAt.observedValue,
                apyFromBeforeOrAtToAtOrAfterWad,
                (queriedTime - beforeOrAt.blockTimestamp) * WadRayMath.WAD
            );
        }
    }

    /// @notice Computes the APY based on the un-annualised rateFromTo value and timeInYears (in wei)
    /// @param rateFromToWad Un-annualised rate (in wei)
    /// @param timeInYearsWad Time in years for the period for which we want to calculate the apy (in wei)
    /// @return apyWad APY for a given rateFromTo and timeInYears
    function computeApyFromRate(uint256 rateFromToWad, uint256 timeInYearsWad)
        internal
        pure
        returns (uint256 apyWad)
    {
        if (rateFromToWad == 0) {
            return 0;
        }

        uint256 exponentWad = PRBMathUD60x18.div(
            PRBMathUD60x18.fromUint(1),
            timeInYearsWad
        );
        uint256 apyPlusOneWad = PRBMathUD60x18.pow(
            (PRBMathUD60x18.fromUint(1) + rateFromToWad),
            exponentWad
        );
        apyWad = apyPlusOneWad - PRBMathUD60x18.fromUint(1);
    }

    /// @inheritdoc IRateOracle
    function getApyFromTo(uint256 from, uint256 to)
        public
        view
        override
        returns (uint256 apyFromToWad)
    {
        require(from <= to, "Misordered dates");

        uint256 rateFromToWad = getRateFromTo(from, to);

        uint256 timeInSeconds = to - from;

        uint256 timeInSecondsWad = PRBMathUD60x18.fromUint(timeInSeconds);

        uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
            timeInSecondsWad
        );

        apyFromToWad = computeApyFromRate(rateFromToWad, timeInYearsWad);
    }

    /// @inheritdoc IRateOracle
    function variableFactor(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) public override(IRateOracle) returns (uint256 resultWad) {
        bool cacheable;

        (resultWad, cacheable) = _variableFactor(
            termStartTimestampInWeiSeconds,
            termEndTimestampInWeiSeconds
        );

        if (cacheable) {
            uint32 termStartTimestamp = Time.timestampAsUint32(
                PRBMathUD60x18.toUint(termStartTimestampInWeiSeconds)
            );
            uint32 termEndTimestamp = Time.timestampAsUint32(
                PRBMathUD60x18.toUint(termEndTimestampInWeiSeconds)
            );
            settlementRateCache[termStartTimestamp][
                termEndTimestamp
            ] = resultWad;
        }

        return resultWad;
    }

    /// @inheritdoc IRateOracle
    function variableFactorNoCache(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) public view override(IRateOracle) returns (uint256 resultWad) {
        (resultWad, ) = _variableFactor(
            termStartTimestampInWeiSeconds,
            termEndTimestampInWeiSeconds
        );
    }

    function _variableFactor(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) private view returns (uint256 resultWad, bool cacheable) {
        uint32 termStartTimestamp = Time.timestampAsUint32(
            PRBMathUD60x18.toUint(termStartTimestampInWeiSeconds)
        );
        uint32 termEndTimestamp = Time.timestampAsUint32(
            PRBMathUD60x18.toUint(termEndTimestampInWeiSeconds)
        );

        require(termStartTimestamp > 0 && termEndTimestamp > 0, "UNITS");
        if (settlementRateCache[termStartTimestamp][termEndTimestamp] != 0) {
            resultWad = settlementRateCache[termStartTimestamp][
                termEndTimestamp
            ];
            cacheable = false;
        } else if (Time.blockTimestampTruncated() >= termEndTimestamp) {
            resultWad = getRateFromTo(termStartTimestamp, termEndTimestamp);
            cacheable = true;
        } else {
            resultWad = getRateFromTo(
                termStartTimestamp,
                Time.blockTimestampTruncated()
            );
            cacheable = false;
        }
    }

    /// @notice Store the current rate (returned by getCurrentRateInRay) into our buffer, unless a rate was written less than minSecondsSinceLastUpdate ago
    /// @param index The index of the Observation that was most recently written to the observations buffer. (Note that at least one Observation is written at contract construction time, so this is always defined.)
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

        uint256 resultRay = getCurrentRateInRay();

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

    /// @inheritdoc IRateOracle
    function writeOracleEntry() external override(IRateOracle) {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }
}
