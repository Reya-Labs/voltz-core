// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../rate_oracles/BaseRateOracle.sol";


contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {

    using SafeMath for uint256;

    IAaveV2LendingPool public override aaveLendingPool;

    constructor(IAaveV2LendingPool _aaveLendingPool, bytes32 _rateOracleId, address underlying) BaseRateOracle(_rateOracleId, underlying) {
        aaveLendingPool = _aaveLendingPool;
    }

    /// @notice Get the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @return A return value of 1e27 (1 Ray) indicates no income since pool creation. A value of 2e27 indicates a 100% yield since pool creation. Etc.
    function getReserveNormalizedIncome(address underlying) public view override returns(uint256){
        return aaveLendingPool.getReserveNormalizedIncome(underlying);
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @param index The index of the Rate that was most recently written to the Rates array
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
        ) public override(BaseRateOracle) returns (uint16 indexUpdated, uint16 cardinalityUpdated) {

        uint256 blockTimestamp = Time.blockTimestampScaled();
        
        Rate memory last = Rates[index];

        // early return if we've already written an Rate this block
        if (last.timestamp == blockTimestamp) return (index, cardinality);

        // if the conditions are right, we can bump the cardinality
        if (cardinalityNext > cardinality && index == (cardinality - 1)) {
            cardinalityUpdated = cardinalityNext;
        } else {
            cardinalityUpdated = cardinality;
        }

        indexUpdated = (index + 1) % cardinalityUpdated;
        
        uint256 result = aaveLendingPool.getReserveNormalizedIncome(underlying);
        require(result != 0, "Oracle only supports active Aave-V2 assets");
        
        // rates[underlying][blockTimestamp] = Rate(blockTimestamp, result);
        Rates[indexUpdated] = Rate(blockTimestamp, result);
        
    }
    
    function computeApyFromRate(uint256 rateFromTo, uint256 timeInYears) internal pure returns (uint256 apy) {
        uint256 exponent = PRBMathUD60x18.div(10**18, timeInYears);
        uint256 apyPlusOne = PRBMathUD60x18.pow((10**18 + rateFromTo), exponent);
        apy = apyPlusOne - 10**18;
    }
    
    /// @inheritdoc BaseRateOracle
    /// @dev Reverts if we have no data point for either timestamp
    function getApyFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) internal view override(BaseRateOracle) returns (uint256 apyFromTo) {

        require(from < to, "Misordered dates");

        uint256 rateFromTo = getRateFromTo(from, to);

        rateFromTo = WadRayMath.rayToWad(rateFromTo);

        uint256 timeInSeconds = to - from; // @audit - this is the wimte in seconds wei

        uint256 timeInYears = FixedAndVariableMath.accrualFact(timeInSeconds);

        apyFromTo = computeApyFromRate(rateFromTo, timeInYears);

    }
    
    /// @notice Calculates the observed interest returned by the underlying in a given period
    /// @dev Reverts if we have no data point for either timestamp
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    /// @return The "floating rate" expressed in Ray, e.g. 4% is encoded as 0.04*10**27 = 4*10*25
    function getRateFromTo(
        uint256 from,
        uint256 to
    ) public view returns (uint256) {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25

        uint256 currentTime = Time.blockTimestampScaled();
        
        Rate memory rateFrom = observeSingle(currentTime, from, oracleVars.RateIndex, oracleVars.RateCardinality);
        Rate memory rateTo = observeSingle(currentTime, to, oracleVars.RateIndex, oracleVars.RateCardinality);

        return
            WadRayMath.rayDiv(rateTo.rateValue, rateFrom.rateValue).sub(
                WadRayMath.RAY
            );
    }

    /// @inheritdoc IRateOracle
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public override(BaseRateOracle, IRateOracle) returns(uint256 result) {
        
        if (Time.blockTimestampScaled() >= termEndTimestamp) {
            require(atMaturity);
            result = getRateFromTo(termStartTimestamp, termEndTimestamp);
        } else {
            require(!atMaturity);
            result = getRateFromTo(termStartTimestamp, Time.blockTimestampScaled());
        }
        
        result = WadRayMath.rayToWad(result);
    }


    // gets the liquidity index
    /// @param currentTime The current block timestamp
    /// @param queriedTime Time to look back to
    /// @param index The index of the Rate that was most recently written to the Rates array
    /// @param cardinality The number of populated elements in the oracle array
    function observeSingle(
        uint256 currentTime,
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality
    ) public override(BaseRateOracle) returns(Rate memory rate) {
        
        if (currentTime == queriedTime) {
            rate = Rates[index];
            if (rate.timestamp != currentTime) {
                // (uint16 indexUpdated, uint16 cardinalityUpdated) = writeRate(index, cardinality, )
                // writeRate();
            }
            // check the rate was correctly updated (unit test)
        }









    }   
}
