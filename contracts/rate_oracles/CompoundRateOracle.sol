// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/ICompoundRateOracle.sol";
import "../interfaces/compound/ICToken.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WadRayMath.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "hardhat/console.sol";

contract CompoundRateOracle is BaseRateOracle, ICompoundRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    /// @dev exchangeRateInRay() returned zero
    error CTokenExchangeRateReturnedZero();

    /// @inheritdoc ICompoundRateOracle
    ICToken public override ctoken;

    /// @inheritdoc ICompoundRateOracle
    uint256 public override decimals;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 2; // id of comp v2 is 2

    constructor(ICToken _ctoken, IERC20Extended underlying)
        BaseRateOracle(underlying)
    {
        ctoken = _ctoken;
        decimals = underlying.decimals();
        uint32 blockTimestamp = Time.blockTimestampTruncated();
        uint256 result = 10000000000000000000000000000000000000000000;
        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        ) = observations.initialize(blockTimestamp, result);
    }

    function exchangeRateInRay() internal view returns (uint256) {
        // cToken exchangeRateStored() returns the current exchange rate as an unsigned integer, scaled by 1 * 10^(18 - 8 + Underlying Token Decimals)
        // source: https://compound.finance/docs/ctokens#exchange-rate
        console.log("Here 1");
        console.log(address(ctoken));
        uint256 _exchangeRateStored = ctoken.exchangeRateStored();
        console.log("Here 2");
        console.log("cToken.address: ", address(ctoken));
        console.log("exchangeRateStored: ", _exchangeRateStored);
        if (decimals >= 18) {
            uint256 scalingFactor = 10**(decimals - 18);
            return WadRayMath.rayDiv(_exchangeRateStored, scalingFactor);
        } else {
            uint256 scalingFactor = 10**(18 - decimals);
            return WadRayMath.rayMul(_exchangeRateStored, scalingFactor);
        }
    }

    /// @notice Store the CToken's current exchange rate, in Ray
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

        uint256 resultRay = exchangeRateInRay();
        if (resultRay == 0) {
            revert CTokenExchangeRateReturnedZero();
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
            return
                WadRayMath.rayToWad(
                    WadRayMath.rayDiv(rateToRay, rateFromRay) - WadRayMath.RAY
                );
        } else {
            /// is this precise, have there been instances where the comp rate is negative?
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
        uint256 apyPlusOne = apyFromBeforeOrAtToAtOrAfterWad +
            PRBMathUD60x18.fromUint(1);
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
        require(currentTime >= queriedTime, "OOO");

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
                console.log("atOrAfter.observedValue", atOrAfter.observedValue);
                console.log(
                    "beforeOrAt.observedValue",
                    beforeOrAt.observedValue
                );
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
