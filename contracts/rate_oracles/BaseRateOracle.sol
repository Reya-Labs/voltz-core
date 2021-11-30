pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/Oracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions

abstract contract BaseRateOracle is IRateOracle {

    bytes32 public immutable override rateOracleId;
    using Oracle for Oracle.Observation[65535];
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

    // todo: override
    OracleVars public oracleVars;

    // todo: override
    Oracle.Observation[65535] public observations;
    
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public virtual override returns(uint256 result);


    // todo: add override, lock the amm when calling this function, noDelegateCall
    function increaseObservarionCardinalityNext(uint16 observationCardinalityNext) external {
        uint16 observationCardinalityNextOld = oracleVars.observationCardinalityNext; // for the event

        uint16 observationCardinalityNextNew = observations.grow(observationCardinalityNextOld, observationCardinalityNext);

        oracleVars.observationCardinalityNext = observationCardinalityNextNew;

        // if (observationCardinalityNextOld != observationCardinalityNextNew)
            // emit IncreaseObservationCardinalityNext(observationCardinalityNextOld, observationCardinalityNextNew);
    }


    function getApyFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) internal view virtual returns (uint256 apyFromTo);
    
    
    function writeOrcleEntry(address underlying) external override {

        Oracle.Observation memory last = observations[oracleVars.observationIndex];
        
        uint256 from = last.blockTimestamp;
        uint256 to = FixedAndVariableMath.blockTimestampScaled();
        
        uint256 apyFromTo = getApyFromTo(underlying, from, to);

        uint256 apyFromToLog = PRBMathUD60x18Typed.log10(
            PRBMath.UD60x18({
                value: apyFromTo
            })
        ).value;

        (oracleVars.observationIndex, oracleVars.observationCardinality) = observations.write(
            oracleVars.observationIndex,
            to,
            apyFromToLog,
            oracleVars.observationCardinality,
            oracleVars.observationCardinalityNext
        );

    }


}