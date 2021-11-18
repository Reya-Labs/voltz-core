pragma solidity ^0.8.0;

import "./interfaces/IAaveRateOracle.sol";
import "./interfaces/underlyingPool/IAaveLendingPool.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";


// todo: fixed point math
contract AaveRateOracle is IAaveRateOracle {

    using SafeMath for uint256; // todo: remove and do fpm

    uint256 public mostRecentTimestamp;
    
    IAaveLendingPool public override lendingPool;
    mapping(address => mapping(uint256 => Rate)) public override rates;

    address constant aaveLendingPoolAddress = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9; // mainnet

    constructor() {
        lendingPool = IAaveLendingPool(aaveLendingPoolAddress);
    }

    // todo: remove and use aave lib instead (or separate test solidity contract)
    function getReserveNormalizedIncome(address underlying) public view override returns(uint256){
        return lendingPool.getReserveNormalizedIncome(underlying);
    }
    
    function updateRate(address underlying) public override {
        
        uint256 result = lendingPool.getReserveNormalizedIncome(underlying);
        require(result != 0, "Oracle only supports active Aave-V2 assets");

        uint256 blockTimestampScaled = FixedAndVariableMath.blockTimestampScaled();
        
        rates[underlying][blockTimestampScaled] = Rate(true, blockTimestampScaled, result);

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
        Rate memory rateFrom = rates[underlying][from];
        Rate memory rateTo = rates[underlying][to];
        require(rateFrom.isSet, "Oracle does not have rateFrom");
        require(rateTo.isSet, "Oracle doesn not have rateTo");
        return
            WadRayMath.rayDiv(rateTo.rateValue, rateFrom.rateValue).sub(
                10**27
            );
    }

    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public override returns(uint256 result) {

        if (FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp) {
            // atMaturity is true
            Rate memory rate = rates[underlyingToken][termEndTimestamp];

            if(!rate.isSet) {
                if (termEndTimestamp == FixedAndVariableMath.blockTimestampScaled()) {
                    updateRate(underlyingToken);
                }    
            }

            result = getRateFromTo(underlyingToken, termStartTimestamp, termEndTimestamp);
            
            result = result / (10 ** (27 - 18)); // 18 decimals, todo: is this optimal?

        }

        // todo: atMaturity is redundunt, remove and replace with if statements based on block.timestamp
        // todo: atMaturity boolean is only relevant for the fixedFactor
        // if (atMaturity) {
            
        //     // todo: require check that current timestamp is after or equal to the maturity date

        //     Rate memory rate = rates[underlyingToken][termEndTimestamp];

        //     if(!rate.isSet) {
        //         // todo: test this logic separately
        //         if (termEndTimestamp == FixedAndVariableMath.blockTimestampScaled()) {
        //             updateRate(underlyingToken);
        //         } // else  raise an error        
        //     }

        //     uint256 rateFromPoolStartToMaturity = getRateFromTo(underlyingToken, termStartTimestamp, termEndTimestamp);
            
        //     rateFromPoolStartToMaturity = rateFromPoolStartToMaturity / (10 ** (27 - 18)); // 18 decimals, todo: is this optimal?

        //     return rateFromPoolStartToMaturity;
        
        // } else {

        //     // todo: make sure the block timestamp does not change from one line to another (does so in the tests)
        //     Rate memory rate = rates[underlyingToken][FixedAndVariableMath.blockTimestampScaled()];

        //     if(!rate.isSet) {
        //         updateRate(underlyingToken);
        //     }

        //     uint256 rateFromPoolStartToNow = getRateFromTo(underlyingToken, termStartTimestamp, FixedAndVariableMath.blockTimestampScaled());

        //     rateFromPoolStartToNow = rateFromPoolStartToNow / 10 ** (27 - 18); // 18 decimals 
            
        //     return rateFromPoolStartToNow;
        // } 
        

    }
}