// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";
import "../core_libraries/Oracle.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions

abstract contract BaseRateOracle is IRateOracle {

    bytes32 public immutable override rateOracleId;
    uint256 public override secondsAgo;

    // should be controlled by the owner
    function setSecondsAgo(uint256 _secondsAgo) external override {

        secondsAgo =  _secondsAgo;

        // emit seconds ago set
    }

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

    // override
    OracleVars public oracleVars;

    // override
    Oracle.Observation[65535] public observations;
    
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public virtual override returns(uint256 result);


    // add override, lock the amm when calling this function, noDelegateCall
    function increaseObservarionCardinalityNext(uint16 observationCardinalityNext) external {
        uint16 observationCardinalityNextOld = oracleVars.observationCardinalityNext; // for the event

        uint16 observationCardinalityNextNew = observations.grow(observationCardinalityNextOld, observationCardinalityNext);

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
    

    
    function getTwapApy(address underlying) external view override returns (uint256 twapApy) {

        // https://uniswap.org/whitepaper-v3.pdf

        // need logApy since the last observation
        Oracle.Observation memory last = observations[oracleVars.observationIndex];
        
        uint256 from = last.blockTimestamp;
        uint256 to = Time.blockTimestampScaled();

        uint256 apyFromTo = getApyFromTo(underlying, from, to);

        uint256 logApy = PRBMathUD60x18.log10(apyFromTo);

        uint256 aT1 = observations.observeSingle(to, secondsAgo, logApy, oracleVars.observationIndex, oracleVars.observationCardinality);
        uint256 aT2 = observations.observeSingle(to, 0, logApy, oracleVars.observationIndex, oracleVars.observationCardinality); 
        
        uint256 logTwapApy = PRBMathUD60x18.div(aT2 - aT1, to - from);

        twapApy = PRBMathUD60x18.powu(logTwapApy, 10);
    }

    
    function writeOrcleEntry(address underlying) external override {

        Oracle.Observation memory last = observations[oracleVars.observationIndex];
        
        // duplicate code
        uint256 from = last.blockTimestamp;
        uint256 to = Time.blockTimestampScaled();
        
        uint256 apyFromTo = getApyFromTo(underlying, from, to);
        uint256 apyFromToLog = PRBMathUD60x18.log10(apyFromTo);

        (oracleVars.observationIndex, oracleVars.observationCardinality) = observations.write(
            oracleVars.observationIndex,
            to,
            apyFromToLog,
            oracleVars.observationCardinality,
            oracleVars.observationCardinalityNext
        );

    }


}
