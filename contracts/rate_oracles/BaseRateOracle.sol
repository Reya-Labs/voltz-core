// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IFactory.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions
abstract contract BaseRateOracle is IRateOracle {
    /// @inheritdoc IRateOracle
    bytes32 public immutable override rateOracleId;

    /// @inheritdoc IRateOracle
    address public immutable override underlying;

    /// @inheritdoc IRateOracle
    uint256 public override secondsAgo;
    /// @inheritdoc IRateOracle
    uint256 public override minSecondsSinceLastUpdate;

    /// @inheritdoc IRateOracle
    OracleVars public override oracleVars;

    /// @inheritdoc IRateOracle
    Rate[65535] public override rates;

    address public immutable override factory;

    /// @dev Must be the Factory owner
    error NotFactoryOwner();

    /// @dev Modifier that ensures a given function can only be called by the top-level factory owner
    modifier onlyFactoryOwner() {
        if (msg.sender != IFactory(factory).owner()) {
            revert NotFactoryOwner();
        }
        _;
    }

    /// @inheritdoc IRateOracle
    function setSecondsAgo(uint256 _secondsAgo)
        external
        override
        onlyFactoryOwner
    {
        secondsAgo = _secondsAgo; // in wei

        // emit seconds ago set
        // unqiue for rate oracle id and the underlying address
    }

    /// @inheritdoc IRateOracle
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

    /// @inheritdoc IRateOracle
    function variableFactor(
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view virtual override returns (uint256 result);

    /// @notice Prepares the rates array to store up to `next` rates
    /// @param current The current next cardinality of the oracle array
    /// @param next The proposed next cardinality which will be populated in the rates array
    /// @return next The next cardinality which will be populated in the rates array
    function grow(uint16 current, uint16 next) internal pure returns (uint16) {
        require(current > 0, "I");

        // no-op if the passed next value isn't greater than the current next value
        if (next <= current) return current;

        return next;
    }

    // AB: lock the amm when calling this function?
    // AB: rename to increaseRateCardinalityNext
    /// @inheritdoc IRateOracle
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

    /// @notice Calculates the observed APY returned by the rate oracle in a given period
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    /// @dev Reverts if we have no data point for either timestamp
    function getApyFromTo(uint256 from, uint256 to)
        internal
        view
        virtual
        returns (uint256 apyFromTo);

    /// @inheritdoc IRateOracle
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    )
        public
        virtual
        override
        returns (uint16 indexUpdated, uint16 cardinalityUpdated);

    /// @inheritdoc IRateOracle
    function observeSingle(
        uint256 currentTime,
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality
    ) public view virtual override returns (uint256 rateValue);

    /// @inheritdoc IRateOracle
    function writeOracleEntry() external virtual override;

    /// @inheritdoc IRateOracle
    function getHistoricalApy()
        external
        view
        virtual
        override
        returns (uint256 historicalApy);

    /// @inheritdoc IRateOracle
    function initialize() public virtual override;
}
