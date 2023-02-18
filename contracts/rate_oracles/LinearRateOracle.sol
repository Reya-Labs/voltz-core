// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./OracleBuffer.sol";
import "./BaseRateOracle.sol";
import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core_libraries/Time.sol";
import "../utils/WadRayMath.sol";

/// @notice Contract base for a Rate Oracle with linear rates implementation.
///  This contract is abstract. To make the contract deployable override the
/// `getLastUpdatedRate` function and the `UNDERLYING_YIELD_BEARING_PROTOCOL_ID` constant.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions
abstract contract LinearRateOracle is BaseRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

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
            uint256 result = WadRayMath.rayToWad(rateToRay - rateFromRay);
            return result;
        } else {
            return 0;
        }
    }

    /// @inheritdoc IRateOracle
    function getRateFrom(uint256 _from)
        public
        view
        override(IRateOracle)
        returns (uint256)
    {
        return getRateFromTo(_from, block.timestamp);
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
            // interpolate rateValue for queriedTime
            rateValueRay = interpolateRateValue(
                beforeOrAt,
                atOrAfter,
                queriedTime
            );
        }
    }

    // linear interpolation, is it different from what we had before?
    function interpolateRateValue(
        OracleBuffer.Observation memory beforeOrAt,
        OracleBuffer.Observation memory atOrAfter,
        uint256 queriedTime
    ) public view virtual returns (uint256 rateValueRay) {
        uint256 rateFromBeforeOrAtToAtOrAfterWad;

        uint256 timeBetweenUpdates = atOrAfter.blockTimestamp -
            beforeOrAt.blockTimestamp;
        uint256 timeSinceBeforeOrAt = queriedTime - beforeOrAt.blockTimestamp;

        uint256 rateBetweenRay = atOrAfter.observedValue -
            beforeOrAt.observedValue;

        rateValueRay =
            beforeOrAt.observedValue +
            (rateBetweenRay / timeBetweenUpdates) *
            timeSinceBeforeOrAt;
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

        apyWad = PRBMathUD60x18.mul(rateFromToWad, exponentWad);
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
    function getApyFrom(uint256 from)
        public
        view
        override
        returns (uint256 apyFromToWad)
    {
        return getApyFromTo(from, block.timestamp);
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

    /// @inheritdoc IRateOracle
    function getLastRateSlope()
        public
        view
        override
        returns (uint256 rateChange, uint32 timeChange)
    {
        uint16 last = oracleVars.rateIndex;
        uint16 lastButOne = (oracleVars.rateIndex >= 1)
            ? oracleVars.rateIndex - 1
            : oracleVars.rateCardinality - 1;

        // check if there are at least two points in the rate oracle
        // otherwise, revert with "Not Enough Points"
        require(
            oracleVars.rateCardinality >= 2 &&
                observations[lastButOne].initialized &&
                observations[lastButOne].observedValue <=
                observations[last].observedValue,
            "NEP"
        );

        rateChange =
            observations[last].observedValue -
            observations[lastButOne].observedValue;
        timeChange =
            observations[last].blockTimestamp -
            observations[lastButOne].blockTimestamp;
    }

    /// @inheritdoc IRateOracle
    function getCurrentRateInRay()
        public
        view
        override
        returns (uint256 currentRate)
    {
        (
            uint32 lastUpdatedTimestamp,
            uint256 lastUpdatedRate
        ) = getLastUpdatedRate();

        if (lastUpdatedTimestamp >= Time.blockTimestampTruncated()) {
            return lastUpdatedRate;
        }

        // We can't get the current rate from the underlying platform, perhaps because it only pushes
        // rates to chain periodically. So we extrapolate the likely current rate from recent rates.
        (uint256 rateChange, uint32 timeChange) = getLastRateSlope();

        currentRate =
            lastUpdatedRate +
            ((Time.blockTimestampTruncated() - lastUpdatedTimestamp) *
                rateChange) /
            timeChange;
    }
}
