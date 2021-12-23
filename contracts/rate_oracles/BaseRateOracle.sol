// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions

abstract contract BaseRateOracle is IRateOracle {

    bytes32 public immutable override rateOracleId;
    uint256 public override secondsAgo;

    struct Observation {
        uint256 timestamp; /// In wei-seconds
        uint256 rateValue; // In wei
    }

    // should be controlled by the owner
    function setSecondsAgo(uint256 _secondsAgo) external override {

        secondsAgo =  _secondsAgo;

        // emit seconds ago set
    }

    constructor(bytes32 _rateOracleId) {
        rateOracleId = _rateOracleId;
    }

    struct OracleVars {
        
        // the most-recently updated index of the observations array
        uint16 observationIndex;

        // the current maximum number of observations that are being stored
        uint16 observationCardinality;

        // the next maximum number of observations to store, triggered in observations.write 
        uint16 observationCardinalityNext;

    }

    function write(
        Observation[65535] storage self,
        uint16 index,
        uint256 blockTimestamp,
        uint256 logApy,
        uint16 cardinality,
        uint16 cardinalityNext
    ) internal returns (uint16 indexUpdated, uint16 cardinalityUpdated) {



    }

    function observeSingle(
        Observation[65535] storage self,
        uint256 time,
        uint256 secondsAgo,
        uint256 logApy,
        uint16 index,
        uint16 cardinality
    ) internal view returns (uint256 logApyCumulative) {

        

    }

    // override
    OracleVars public oracleVars;

    // override
    Observation[65535] public observations;
    
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public virtual override returns(uint256 result);


    function grow(
        uint16 current,
        uint16 next
    ) internal returns (uint16) {
        require(current > 0, "I");

        // no-op if the passed next value isn't greater than the current next value
        if (next <= current) return current;

        // store in each slot to prevent fresh SSTOREs in swaps 
        // this data will not be used because the initialized boolean is still false
        for (uint16 i = current; i < next; i++) observations[i].timestamp = 1;

        return next;

    }

    
    // add override, lock the amm when calling this function, noDelegateCall
    function increaseObservarionCardinalityNext(uint16 observationCardinalityNext) external {
        uint16 observationCardinalityNextOld = oracleVars.observationCardinalityNext; // for the event

        uint16 observationCardinalityNextNew = grow(observationCardinalityNextOld, observationCardinalityNext);

        oracleVars.observationCardinalityNext = observationCardinalityNextNew;

        // if (observationCardinalityNextOld != observationCardinalityNextNew)
            // emit IncreaseObservationCardinalityNext(observationCardinalityNextOld, observationCardinalityNextNew);
    }

    /// @notice Calculates the observed APY returned by the underlying in a given period
    /// @param underlying The address of an underlying ERC20 token known to this Oracle (e.g. USDC not aaveUSDC)
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    function getApyFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) internal view virtual returns (uint256 apyFromTo);
    
    
    function updateRate(address underlying) public virtual {

    } 
    


}
