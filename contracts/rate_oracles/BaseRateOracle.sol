// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions

abstract contract BaseRateOracle is IRateOracle {
    bytes32 public immutable override rateOracleId;
    address public immutable override underlying;
    uint256 public override secondsAgo;
    uint256 public override minSecondsSinceLastUpdate; 
    // AB: as long as this doesn't affect the termEndTimestamp rateValue too much
    // AB: can have a different minSecondsSinceLastUpdate close to termEndTimestamp to have more granularity for settlement purposes

    // override
    OracleVars public override oracleVars;
    Rate[65535] public override rates;

    address public immutable override factory;

    /// @dev Must be the Factory owner
    error NotFactoryOwner();

    modifier onlyFactoryOwner() {
        if (msg.sender != IFactory(factory).owner()) {
            revert NotFactoryOwner();
        }
        _;
    }

    function setSecondsAgo(uint256 _secondsAgo)
        external
        override
        onlyFactoryOwner
    {
        secondsAgo = _secondsAgo; // in wei

        // emit seconds ago set
        // unqiue for rate oracle id and the underlying address
    }

    function setMinSecondsSinceLastUpdate(uint256 _minSecondsSinceLastUpdate)
        external
        override
        onlyFactoryOwner
    {
        minSecondsSinceLastUpdate = _minSecondsSinceLastUpdate; // in wei

        // emit
    }

    constructor(
        bytes32 _rateOracleId,
        address _underlying,
        address _factory
    ) {
        rateOracleId = _rateOracleId;
        underlying = _underlying;
        factory = _factory;
    }

    function variableFactor(
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view virtual override returns (uint256 result);

    function grow(uint16 current, uint16 next) internal pure returns (uint16) {
        require(current > 0, "I");

        // no-op if the passed next value isn't greater than the current next value
        if (next <= current) return current;

        return next;
    }

    // add override, lock the amm when calling this function, noDelegateCall
    function increaseObservarionCardinalityNext(uint16 rateCardinalityNext)
        external
        override
    {
        uint16 rateCardinalityNextOld = oracleVars.rateCardinalityNext; // for the event

        uint16 rateCardinalityNextNew = grow(
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

    /// @notice Calculates the observed APY returned by the underlying in a given period
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    function getApyFromTo(uint256 from, uint256 to)
        internal
        view
        virtual
        returns (uint256 apyFromTo);

    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    )
        public
        virtual
        override
        returns (uint16 indexUpdated, uint16 cardinalityUpdated);

    function observeSingle(
        uint256 currentTime,
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality
    ) public view virtual override returns (uint256 rateValue);

    function writeOracleEntry() external virtual override;

    function getHistoricalApy()
        external
        view
        virtual
        override
        returns (uint256 historicalApy);

    function initialize() public virtual override;
}
