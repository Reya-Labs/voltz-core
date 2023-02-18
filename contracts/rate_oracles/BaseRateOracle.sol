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
///  This contract is abstract and partially implemented by the Compounding and Linear Contracts.
/// @dev Each specific oracle need to implement either Linear or Compounding contracts.
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

    struct BlockInfo {
        uint32 timestamp;
        uint256 number;
    }

    struct BlockSlopeInfo {
        uint32 timeChange;
        uint256 blockChange;
    }

    /// @inheritdoc IRateOracle
    IERC20Minimal public immutable override underlying;

    /// @inheritdoc IRateOracle
    uint256 public override minSecondsSinceLastUpdate;

    OracleVars public oracleVars;

    /// @notice the observations tracked over time by this oracle
    OracleBuffer.Observation[65535] public observations;

    BlockInfo public lastUpdatedBlock;
    BlockSlopeInfo public currentBlockSlope;

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

        lastUpdatedBlock.number = block.number;
        lastUpdatedBlock.timestamp = Time.blockTimestampTruncated();

        currentBlockSlope.timeChange = 1500;
        currentBlockSlope.blockChange = 100;
    }

    /// @dev this must be called at the *end* of the constructor, after the contract member variables have been set, because it needs to read rates.
    function _populateInitialObservations(
        uint32[] memory _times,
        uint256[] memory _results,
        bool includeLatestDataPoint
    ) internal {
        // If we're using even half the max buffer size, something has gone wrong
        require(_times.length < OracleBuffer.MAX_BUFFER_LENGTH / 2, "MAXT");
        uint16 length = uint16(_times.length);
        require(length == _results.length, "Lengths must match");

        // At least 1 initial observation is required
        require(
            includeLatestDataPoint || length > 0,
            "No initial observations"
        );

        // We must pass equal-sized dynamic arrays containing initial timestamps and observed values
        uint16 observationsLength = length + (includeLatestDataPoint ? 1 : 0);
        uint32[] memory times = new uint32[](observationsLength);
        uint256[] memory results = new uint256[](observationsLength);
        for (uint256 i = 0; i < length; i++) {
            times[i] = _times[i];
            results[i] = _results[i];
        }

        if (includeLatestDataPoint) {
            (
                uint32 lastUpdatedTimestamp,
                uint256 lastUpdatedRate
            ) = getLastUpdatedRate();

            // `observations.initialize` will check that all times are correctly sorted so no need to check here
            times[length] = lastUpdatedTimestamp;
            results[length] = lastUpdatedRate;
        }

        (
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext,
            oracleVars.rateIndex
        ) = observations.initialize(times, results);
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

    /// @notice Get the last updated rate in Ray with the accompanying truncated timestamp
    /// This data point must be a known data point from the source of the data, and not extrapolated or interpolated by us.
    /// The source and expected values of "rate" may differ by rate oracle type. All that
    /// matters is that we can divide one "rate" by another "rate" to get the factor of growth between the two timestamps.
    /// For example if we have rates of { (t=0, rate=5), (t=100, rate=5.5) }, we can divide 5.5 by 5 to get a growth factor
    /// of 1.1, suggesting that 10% growth in capital was experienced between timesamp 0 and timestamp 100.
    /// @dev FOr convenience, the rate is normalised to Ray for storage, so that we can perform consistent math across all rates.
    /// @dev This function should revert if a valid rate cannot be discerned
    /// @return timestamp the timestamp corresponding to the known rate (could be the current time, or a time in the past)
    /// @return rate the rate in Ray (decimal scaled up by 10^27 for storage in a uint256)
    function getLastUpdatedRate()
        public
        view
        virtual
        returns (uint32 timestamp, uint256 rate);

    /// @notice Store the last updated rate (returned by getLastUpdatedRate) into our buffer, unless a rate was written less than minSecondsSinceLastUpdate ago
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

        (
            uint32 lastUpdatedTimestamp,
            uint256 lastUpdatedRate
        ) = getLastUpdatedRate();

        // early return (to increase ttl of data in the observations buffer) if we've already written an observation recently
        if (
            lastUpdatedTimestamp <
            last.blockTimestamp + minSecondsSinceLastUpdate
        ) return (index, cardinality);

        emit OracleBufferUpdate(
            Time.blockTimestampScaled(),
            address(this),
            index,
            lastUpdatedTimestamp,
            lastUpdatedRate,
            cardinality,
            cardinalityNext
        );

        currentBlockSlope.blockChange = block.number - lastUpdatedBlock.number;
        currentBlockSlope.timeChange =
            Time.blockTimestampTruncated() -
            lastUpdatedBlock.timestamp;

        lastUpdatedBlock.number = block.number;
        lastUpdatedBlock.timestamp = Time.blockTimestampTruncated();

        return
            observations.write(
                index,
                lastUpdatedTimestamp,
                lastUpdatedRate,
                cardinality,
                cardinalityNext
            );
    }

    /// @inheritdoc IRateOracle
    function writeOracleEntry() external virtual override(IRateOracle) {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }

    /// @inheritdoc IRateOracle
    function getBlockSlope()
        public
        view
        override
        returns (uint256 blockChange, uint32 timeChange)
    {
        return (currentBlockSlope.blockChange, currentBlockSlope.timeChange);
    }
}
