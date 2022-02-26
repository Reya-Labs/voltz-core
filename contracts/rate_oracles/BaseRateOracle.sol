// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../core_libraries/Time.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions
abstract contract BaseRateOracle is IRateOracle, Ownable {
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
    address public immutable override underlying;

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
        minSecondsSinceLastUpdate = _minSecondsSinceLastUpdate; // in wei

        emit MinSecondsSinceLastUpdateSet(_minSecondsSinceLastUpdate);
    }

    constructor(address _underlying) {
        underlying = _underlying;
    }

    // AB: lock the amm when calling this function?
    /// @inheritdoc IRateOracle
    function increaseObservarionCardinalityNext(uint16 rateCardinalityNext)
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
            emit IncreaserateCardinalityNext(
                rateCardinalityNextOld,
                rateCardinalityNextNew
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
    function getRateFromTo(uint256 from, uint256 to)
        public
        view
        virtual
        override
        returns (uint256);

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
        } else if (Time.blockTimestampTruncated() >= termEndTimestamp) {
            resultWad = getRateFromTo(termStartTimestamp, termEndTimestamp);
            cacheable = true;
        } else {
            resultWad = getRateFromTo(
                termStartTimestamp,
                Time.blockTimestampTruncated()
            );
        }
        return (resultWad, cacheable);
    }

    /// @inheritdoc IRateOracle
    function writeOracleEntry() external virtual override;
}
