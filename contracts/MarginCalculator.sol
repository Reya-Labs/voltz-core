pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";


contract MarginCalculator {

    using PRBMathUD60x18 for uint256;
    
    uint256 public apyUpper;
    uint256 public apyLower;

    uint256 public apyUpperMultiplier;
    uint256 public apyLowerMultiplier; 

    uint256 public minDeltaLM;
    uint256 public minDeltaIM;

    uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;

    // todo: remove (used for testing purposes only)
    function doDiv(uint256 x, uint256 y) external pure returns (uint256 result) {
        result = PRBMathUD60x18.div(x, y);
    }

    // todo: make the function internal
    function accrualFact(uint256 timePeriodInSeconds) external pure returns (uint256 timePeriodInYears) {
        timePeriodInYears = PRBMathUD60x18.div(timePeriodInSeconds, SECONDS_IN_YEAR);
    }




}







// contract MarginCalculator {
    
//     uint256 public apyUpperX128;
//     uint256 public apyLowerX128;

//     uint256 public apyUpperMultiplier;
//     uint256 public apyLowerMultiplier; 

//     uint256 public minDeltaLMX128;
//     uint256 public minDeltaIMX128;

//     uint256 public constant SECONDS_IN_YEAR = 31536000;

//     using SafeMath for uint256; // todo: is this the best approach? Maybe need a separate function in FullMath

//     function accrual_fact(uint256 timePeriod)
//         internal
//         pure
//         returns (uint256)
//     {

//         uint256 timePeriodInYearsX128 = FullMath.mulDiv(timePeriod, FixedPoint128.Q128, SECONDS_IN_YEAR);

//         return timePeriodInYearsX128;
//     }


//     function getFTMarginRequirement(
//         uint256 notionalX128,
//         uint256 fixedRateX128,
//         uint256 timePeriodInYearsX128,
//         bool isLM
//     )  internal returns(uint256 margin) {
        
//         uint256 rateDeltaX128
        
//         if (isLM) {
//             rateDeltaX128 = apyUpperX128 - fixedRateX128;
//             rateDeltaX128 = rateDeltaX128 > minDeltaIMX128 ? rateDeltaX128 : minDeltaIMX128;
//         } else {
//             rateDeltaX128 = apyUpperX128.mul(apyUpperMultiplier)
//         }

//     }

// }