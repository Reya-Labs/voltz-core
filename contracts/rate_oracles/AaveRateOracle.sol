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

    // todo: bring some of the conditional logic from amm to here
    // todo: remove and use aave lib instead (or separate test solidity contract)
    function getReserveNormalizedIncome(address underlying) public view override returns(uint256){
        return aaveLendingPool.getReserveNormalizedIncome(underlying);
    }

    function updateRate(address underlying) public override {
        
        uint256 result = aaveLendingPool.getReserveNormalizedIncome(underlying);
        require(result != 0, "Oracle only supports active Aave-V2 assets");

        uint256 blockTimestampScaled = FixedAndVariableMath.blockTimestampScaled();
        
        rates[underlying][blockTimestampScaled] = IRateOracle.Rate(true, blockTimestampScaled, result);

        mostRecentTimestamp = blockTimestampScaled;
        
    }
    
    function getRateFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) public view override returns (uint256) {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, i.e. index 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25
        IRateOracle.Rate memory rateFrom = rates[underlying][from];
        IRateOracle.Rate memory rateTo = rates[underlying][to];
        require(rateFrom.isSet, "Oracle does not have rateFrom");
        require(rateTo.isSet, "Oracle doesn not have rateTo");
        return
            WadRayMath.rayDiv(rateTo.rateValue, rateFrom.rateValue).sub(
                10**27
            );
    }

    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public override(BaseRateOracle, IRateOracle) returns(uint256 result) {

        IRateOracle.Rate memory rate;
        
        if (FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp) {
            // atMaturity is true
            rate = rates[underlyingToken][termEndTimestamp];

            if(!rate.isSet) {
                if (termEndTimestamp == FixedAndVariableMath.blockTimestampScaled()) {
                    updateRate(underlyingToken);
                }    
            }

            result = getRateFromTo(underlyingToken, termStartTimestamp, termEndTimestamp);

        } else {
            if (atMaturity) {
                revert();
            } else {
                rate = rates[underlyingToken][FixedAndVariableMath.blockTimestampScaled()];

                if(!rate.isSet) {
                    updateRate(underlyingToken);
                }

                result = getRateFromTo(underlyingToken, termStartTimestamp, FixedAndVariableMath.blockTimestampScaled());
            }
        }

        result = result / (10 ** (27 - 18)); // 18 decimals, todo: is this optimal?
    }
}