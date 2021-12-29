// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "hardhat/console.sol";


contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {

    using SafeMath for uint256;

    // IAaveV2LendingPool public override aaveLendingPool;
    address public override aaveLendingPool;

    constructor(address _aaveLendingPool, bytes32 _rateOracleId, address underlying) BaseRateOracle(_rateOracleId, underlying) {
        aaveLendingPool = _aaveLendingPool;
        // console.log("Test Contract: Aave lending pool address is: ", _aaveLendingPool);
    }

    /// @notice Get the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @return A return value of 1e27 (1 Ray) indicates no income since pool creation. A value of 2e27 indicates a 100% yield since pool creation. Etc.
    function getReserveNormalizedIncome(address underlying) public view override(IAaveRateOracle) returns(uint256) {
        return IAaveV2LendingPool(aaveLendingPool).getReserveNormalizedIncome(underlying);
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @param index The index of the Rate that was most recently written to the Rates array
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
        ) public override(BaseRateOracle, IRateOracle) returns (uint16 indexUpdated, uint16 cardinalityUpdated) {

        Rate memory last = rates[index];

        uint256 blockTimestamp = Time.blockTimestampScaled();
        
        if (last.timestamp != 0) {
            uint256 timeDeltaSinceLastUpdate = blockTimestamp - last.timestamp;
            // console.log("Test Contract: timeDeltaSinceLastUpdate", timeDeltaSinceLastUpdate);
            // console.log("Test Contract: last.timestamp", last.timestamp);
            // console.log("Test Contract: blockTimestamp", blockTimestamp);
            require(timeDeltaSinceLastUpdate > minSecondsSinceLastUpdate, "throttle updates");
        }
        
        // early return if we've already written a Rate in this block
        if (last.timestamp == blockTimestamp) return (index, cardinality);

        // if the conditions are right, we can bump the cardinality
        if (cardinalityNext > cardinality && index == (cardinality - 1)) {
            cardinalityUpdated = cardinalityNext;
        } else {
            cardinalityUpdated = cardinality;
        }

        indexUpdated = (index + 1) % cardinalityUpdated;
        
        uint256 result = IAaveV2LendingPool(aaveLendingPool).getReserveNormalizedIncome(underlying);
        require(result != 0, "Oracle only supports active Aave-V2 assets");
        
        // rates[underlying][blockTimestamp] = Rate(blockTimestamp, result);
        rates[indexUpdated] = Rate(blockTimestamp, result);
        
    }
    
    function computeApyFromRate(uint256 rateFromTo, uint256 timeInYears) internal pure returns (uint256 apy) {
        uint256 exponent = PRBMathUD60x18.div(10**18, timeInYears);
        uint256 apyPlusOne = PRBMathUD60x18.pow((10**18 + rateFromTo), exponent);
        apy = apyPlusOne - 10**18;
    }
    
    /// @inheritdoc BaseRateOracle
    /// @dev Reverts if we have no data point for either timestamp
    function getApyFromTo(
        uint256 from,
        uint256 to
    ) internal override(BaseRateOracle) returns (uint256 apyFromTo) {

        require(from < to, "Misordered dates");

        uint256 rateFromTo = getRateFromTo(from, to);

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
    ) public returns (uint256) {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25

        uint256 currentTime = Time.blockTimestampScaled();
        
        uint256 rateFrom = observeSingle(currentTime, from, oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
        uint256 rateTo = observeSingle(currentTime, to, oracleVars.rateIndex, oracleVars.rateCardinality, oracleVars.rateCardinalityNext);
        
        return
            WadRayMath.rayToWad(WadRayMath.rayDiv(rateTo, rateFrom).sub(
                WadRayMath.RAY
            ));
    }

    /// @inheritdoc IRateOracle
    function variableFactor(bool atMaturity, uint256 termStartTimestamp, uint256 termEndTimestamp) public override(BaseRateOracle, IRateOracle) returns(uint256 result) {
        
        if (Time.blockTimestampScaled() >= termEndTimestamp) {
            require(atMaturity);
            result = getRateFromTo(termStartTimestamp, termEndTimestamp);
        } else {
            require(!atMaturity);
            result = getRateFromTo(termStartTimestamp, Time.blockTimestampScaled());
        }
    }


    function binarySearch(
        uint256 target,
        uint16 index,
        uint16 cardinality
    ) internal view returns (Rate memory beforeOrAt, Rate memory atOrAfter) { 
        uint256 l = (index + 1) % cardinality; // oldest observation
        uint256 r = l + cardinality - 1; // newest observation
        uint256 i;

        while (true) {
            i = (l + r) / 2;
            beforeOrAt = rates[i % cardinality];
            
            // we've landed on an uninitialized tick, keep searching higher (more recently)
            if (beforeOrAt.timestamp == 0) {
                l = i + 1;
                continue;
            }
            
            atOrAfter = rates[(i + 1) % cardinality];
            
            bool targetAtOrAfter = beforeOrAt.timestamp <= target;

            // check if we've found the answer!
            if (targetAtOrAfter && target <= atOrAfter.timestamp) break;

            if (!targetAtOrAfter) r = i - 1;
            else l = i + 1;
        }

    }

    
    /// @notice Fetches the observations beforeOrAt and atOrAfter a given target, i.e. where [beforeOrAt, atOrAfter] is satisfied
    /// @dev Assumes there is at least 1 initialized observation.
    /// Used by observeSingle() to compute the counterfactual liquidity index values as of a given block timestamp.
    /// @param target The timestamp at which the reserved observation should be for
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param cardinality The number of populated elements in the oracle array
    /// @return beforeOrAt The observation which occurred at, or before, the given timestamp
    /// @return atOrAfter The observation which occurred at, or after, the given timestamp
    function getSurroundingRates(
        uint256 target,
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    ) private returns (Rate memory beforeOrAt, Rate memory atOrAfter) {
        
        // optimistically set before to the newest rate
        beforeOrAt = rates[index];

        if (beforeOrAt.timestamp <= target) {
            if (beforeOrAt.timestamp == target) {
                // if the newest observation eqauls target, we are in the same block, so we can ignore atOrAfter
                return (beforeOrAt, atOrAfter);
            } else {
                // otherwise, we need to transform
                // return (beforeOrAt, transform(beforeOrAt, target, logApy));
                (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(index, cardinality, cardinalityNext);
                atOrAfter = rates[oracleVars.rateIndex];
                return (beforeOrAt, atOrAfter);
            }
        }

        // set to the oldest observation
        beforeOrAt = rates[(index + 1) % cardinality];
        
        if (beforeOrAt.timestamp == 0) {
            beforeOrAt = rates[0];
        }

        require(beforeOrAt.timestamp <= target, "OLD");

        // if we've reached this point, we have to binary search
        return binarySearch(target, index, cardinality);

    }


    // time delta is in seconds
    function interpolateRateValue(
        uint256 beforeOrAtRateValue,
        uint256 apyFromBeforeOrAtToAtOrAfter,
        uint256 timeDeltaBeforeOrAtToQueriedTime
    ) internal pure returns (uint256 rateValue) {
        uint256 timeInYears = FixedAndVariableMath.accrualFact(timeDeltaBeforeOrAtToQueriedTime);
        uint256 exp1 = PRBMathUD60x18.pow((10**18 + apyFromBeforeOrAtToAtOrAfter), timeInYears) - 10**18;
        rateValue = PRBMathUD60x18.mul(beforeOrAtRateValue, exp1);
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
        uint16 cardinality,
        uint16 cardinalityNext
    ) public override(BaseRateOracle, IRateOracle) returns(uint256 rateValue) {
        
        if (currentTime == queriedTime) {
            Rate memory rate;
            rate = rates[index];
            if (rate.timestamp != currentTime) {
                (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(index, cardinality, cardinalityNext);
                rate = rates[oracleVars.rateIndex];
                // check the rate was correctly updated (unit test)
                rateValue = rate.rateValue;
            } else {
                rateValue = rate.rateValue;
            }
        }
        
        (Rate memory beforeOrAt, Rate memory atOrAfter) = getSurroundingRates(queriedTime, index, cardinality, cardinalityNext);

        if (queriedTime == beforeOrAt.timestamp) {
            // we are at the left boundary
            rateValue = beforeOrAt.rateValue;
        } else if (queriedTime == atOrAfter.timestamp) {
            // we are at the right boundary
            rateValue =  atOrAfter.rateValue;
        } else {
            // we are in the middle

            // find apy between beforeOrAt and atOrAfter
            uint256 rateFromBeforeOrAtToAtOrAfter = WadRayMath.rayDiv(atOrAfter.rateValue, beforeOrAt.rateValue).sub(WadRayMath.RAY);
            uint256 timeInYears = FixedAndVariableMath.accrualFact(atOrAfter.timestamp - beforeOrAt.timestamp);
            uint256 apyFromBeforeOrAtToAtOrAfter = computeApyFromRate(rateFromBeforeOrAtToAtOrAfter, timeInYears);

            // interpolate rateValue for queriedTime
            rateValue = interpolateRateValue(beforeOrAt.rateValue, apyFromBeforeOrAtToAtOrAfter, queriedTime - beforeOrAt.timestamp);

        }
    }   


    function writeOracleEntry() external override(BaseRateOracle, IRateOracle) {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }

    function getHistoricalApy() external override(BaseRateOracle, IRateOracle) returns (uint256 historicalApy) {

        uint256 to = Time.blockTimestampScaled();
        uint256 from = to - secondsAgo;

        return getApyFromTo(from, to);
    }

    function initialize() public override(BaseRateOracle, IRateOracle) {

        oracleVars.rateCardinalityNext = 1;
        oracleVars.rateCardinality = 1;

        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );

        // oracleVars.rateIndex = 0, oracleVars.rateCardinality = 1
        
    }


}
