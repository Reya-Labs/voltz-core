// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OracleBuffer.sol";
import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions
abstract contract BaseRateOracle is IRateOracle {
    using OracleBuffer for OracleBuffer.Observation[65535];

    uint256 public constant ONE_WEI = 10**18;

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
    address public immutable override factory;

    /// @dev Must be the Factory owner
    error NotFactoryOwner();

    /// @dev Modifier that ensures a given function can only be called by the top-level factory owner
    // @audit - don't love this auth pattern - potentially gas inefficient to call out to the factory and get its owner all the time, and also relatively easy to change or renounce the factory ownership without realising that this affects other contracts. We should think about our plans for ownership and auth and see if there's not a better approach, but if we stick with having the owner of all contracts in one place we should consider giving it a more descriptive name like systemAdmin or systemOwner.
    modifier onlyFactoryOwner() {
        if (msg.sender != IFactory(factory).owner()) {
            revert NotFactoryOwner();
        }
        _;
    }

    /// @inheritdoc IRateOracle
    function setMinSecondsSinceLastUpdate(uint256 _minSecondsSinceLastUpdate)
        external
        override
        onlyFactoryOwner
    {
        minSecondsSinceLastUpdate = _minSecondsSinceLastUpdate; // in wei

        // @audit emit event
    }

    constructor(address _underlying, address _factory) {
        underlying = _underlying;
        factory = _factory;
    }

    // /// @notice Prepares the rates array to store up to `next` rates
    // /// @param current The current next cardinality of the oracle array
    // /// @param next The proposed next cardinality which will be populated in the rates array
    // /// @return next The next cardinality which will be populated in the rates array
    // // @audit - this doesn't seem to do anything useful? In the uniswap implementation it is used to pay the gas required for writing non-zero values to storage slots, but we're not doing that here. We probably should do it here, in this function, but if we choose not to then this function should probably just be deleted or merged with increaseObservarionCardinalityNext
    // function grow(uint16 current, uint16 next) internal pure returns (uint16) {
    //     require(current > 0, "I");

    //     // no-op if the passed next value isn't greater than the current next value
    //     if (next <= current) return current;

    //     return next;
    // }

    // AB: lock the amm when calling this function?
    // AB: rename to increaseRateCardinalityNext
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
    /// @param rateFromTo Un-annualised rate (in wei)
    /// @param timeInYears Time in years for the period for which we want to calculate the apy (in wei)
    /// @return apy APY for a given rateFromTo and timeInYears
    function computeApyFromRate(uint256 rateFromTo, uint256 timeInYears)
        internal
        pure
        returns (uint256 apy)
    {
        if (rateFromTo == 0) {
            return 0;
        }
        uint256 exponent = PRBMathUD60x18.div(ONE_WEI, timeInYears);
        uint256 apyPlusOne = PRBMathUD60x18.pow(
            (ONE_WEI + rateFromTo),
            exponent
        );
        apy = apyPlusOne - ONE_WEI;
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
        returns (uint256 apyFromTo)
    {
        require(from <= to, "Misordered dates");

        uint256 rateFromTo = getRateFromTo(from, to);

        uint256 timeInSeconds = to - from;

        uint256 timeInYears = FixedAndVariableMath.accrualFact(timeInSeconds);

        apyFromTo = computeApyFromRate(rateFromTo, timeInYears);
    }

    /// @inheritdoc IRateOracle
    function variableFactor(
        uint256 termStartTimestampInWeiSeconds,
        uint256 termEndTimestampInWeiSeconds
    ) public view override(IRateOracle) returns (uint256 result) {
        uint256 termStartTimestamp = PRBMathUD60x18.toUint(
            termStartTimestampInWeiSeconds
        );
        uint256 termEndTimestamp = PRBMathUD60x18.toUint(
            termEndTimestampInWeiSeconds
        );

        require(termStartTimestamp > 0 && termEndTimestamp > 0, "UNITS");
        if (Time.blockTimestampTruncated() >= termEndTimestamp) {
            result = getRateFromTo(termStartTimestamp, termEndTimestamp);
        } else {
            result = getRateFromTo(
                termStartTimestamp,
                Time.blockTimestampTruncated()
            );
        }
    }

    // @audit - not needed?
    // function writeRate(
    //     uint16 index,
    //     uint16 cardinality,
    //     uint16 cardinalityNext
    // )
    //     internal
    //     virtual
    //     override
    //     returns (uint16 indexUpdated, uint16 cardinalityUpdated);

    /// @inheritdoc IRateOracle
    function writeOracleEntry() external virtual override;
}
