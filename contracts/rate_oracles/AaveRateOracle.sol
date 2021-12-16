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

    uint256 public mostRecentTimestamp;

    mapping(address => mapping(uint256 => Rate)) public rates;
    
    IAaveV2LendingPool public override aaveLendingPool;

    constructor(IAaveV2LendingPool _aaveLendingPool, bytes32 _rateOracleId) BaseRateOracle(_rateOracleId) {
        aaveLendingPool = _aaveLendingPool;
    }

    /// @notice Get the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @return A return value of 1e27 (1 Ray) indicates no income since pool creation. A value of 2e27 indicates a 100% yield since pool creation. Etc.
    function getReserveNormalizedIncome(address underlying) public view override returns(uint256){
        return aaveLendingPool.getReserveNormalizedIncome(underlying);
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    function updateRate(address underlying) public override {
        
        uint256 result = aaveLendingPool.getReserveNormalizedIncome(underlying);
        require(result != 0, "Oracle only supports active Aave-V2 assets");

        uint256 blockTimestampScaled = Time.blockTimestampScaled();
        
        rates[underlying][blockTimestampScaled] = IRateOracle.Rate(true, blockTimestampScaled, result);

        mostRecentTimestamp = blockTimestampScaled;
        
    }
    
    /// @inheritdoc BaseRateOracle
    /// @dev Reverts if we have no data point for either timestamp
    function getApyFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) internal view override(BaseRateOracle) returns (uint256 apyFromTo) {

        require(from < to, 'Misordered dates');

        uint256 rateFromTo = getRateFromTo(underlying, from, to);
        
        // @audit - should we use WadRayMath.rayToWad() (rounds up not down)
        rateFromTo =  rateFromTo / (10 ** (27 - 18)); // convert to wei
        uint256 timeInSeconds = to - from; // @audit - this is the wimte in seconds wei

        uint256 timeInYears = FixedAndVariableMath.accrualFact(timeInSeconds);

        apyFromTo = PRBMathUD60x18.mul(rateFromTo, timeInYears);

    }
    
    /// @notice Calculates the observed interest returned by the underlying in a given period
    /// @dev Reverts if we have no data point for either timestamp
    /// @param underlying The address of an underlying ERC20 token known to this Oracle (e.g. USDC not aaveUSDC)
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    /// @return The "floating rate" expressed in Ray, e.g. 4% is encoded as 0.04*10**27 = 4*10*25
    function getRateFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) public view override returns (uint256) {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25
        IRateOracle.Rate memory rateFrom = rates[underlying][from];
        IRateOracle.Rate memory rateTo = rates[underlying][to];
        require(rateFrom.isSet, "Oracle does not have rateFrom");
        require(rateTo.isSet, "Oracle doesn not have rateTo");
        return
            WadRayMath.rayDiv(rateTo.rateValue, rateFrom.rateValue).sub(
                WadRayMath.RAY
            );
    }

    /// @inheritdoc BaseRateOracle
    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public override(BaseRateOracle, IRateOracle) returns(uint256 result) {

        IRateOracle.Rate memory rate;
        
        if (Time.blockTimestampScaled() >= termEndTimestamp) {
            // atMaturity is true
            rate = rates[underlyingToken][termEndTimestamp];

            if(!rate.isSet) {
                if (termEndTimestamp == Time.blockTimestampScaled()) {
                    updateRate(underlyingToken);
                } else {
                    // @audit We are asking for rates up until an end timestamp for which we already know we have no date. We are going to revert What to do? Better to revert here explicity, or extrapolate? 
                }    
            }

            result = getRateFromTo(underlyingToken, termStartTimestamp, termEndTimestamp);

        } else {
            if (atMaturity) {
                revert();
            } else {
                rate = rates[underlyingToken][Time.blockTimestampScaled()];

                if(!rate.isSet) {
                    updateRate(underlyingToken);
                }

                result = getRateFromTo(underlyingToken, termStartTimestamp, Time.blockTimestampScaled());
            }
        }

        // @audit - should we use WadRayMath.rayToWad() (rounds up not down)
        result = result / (10 ** (27 - 18)); // 18 decimals, AB: is this optimal?
    }
}
