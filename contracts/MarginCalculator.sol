pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";


contract MarginCalculator {

    // using PRBMathUD60x18 for uint256;
    
    uint256 public apyUpper = 9 * 10**16; // 0.09, 9%
    uint256 public apyLower = 1 * 10**16; // 0.01, 1%;

    uint256 public apyUpperMultiplier = 2 * 10**18; // 2.0
    uint256 public apyLowerMultiplier = 5 * 10**17; // 0.5

    uint256 public minDeltaLM = 125 * 10**14; // 0.00125
    uint256 public minDeltaIM = 500 * 10**14; // 0.05

    uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;


    // todo: make the function internal
    function accrualFact(uint256 timePeriodInSeconds) public pure returns (uint256 timePeriodInYears) {
        PRBMath.UD60x18 memory xUD = PRBMath.UD60x18({ value: timePeriodInSeconds });
        PRBMath.UD60x18 memory yUD = PRBMath.UD60x18({ value: SECONDS_IN_YEAR });

        timePeriodInYears = PRBMathUD60x18Typed.div(xUD, yUD).value;
    }


    function getFTMarginRequirement(uint256 notional, uint256 fixedRate, uint256 timePeriodInSeconds, bool isLM) external view returns(uint256 margin) {
        

        // todo: only load vars in the if statements for optimisation
        PRBMath.UD60x18 memory notionalUD = PRBMath.UD60x18({ value: notional });
        PRBMath.UD60x18 memory fixedRateUD = PRBMath.UD60x18({ value: fixedRate });
        
        PRBMath.UD60x18 memory apyUpperUD = PRBMath.UD60x18({ value: apyUpper });
        
        PRBMath.UD60x18 memory apyUpperMultiplierUD = PRBMath.UD60x18({ value: apyUpperMultiplier });
        
        PRBMath.UD60x18 memory minDeltaLMUD = PRBMath.UD60x18({ value: minDeltaLM });
        PRBMath.UD60x18 memory minDeltaIMUD = PRBMath.UD60x18({ value: minDeltaIM });

        PRBMath.UD60x18 memory rateDeltaUD;

        if (isLM) {
            rateDeltaUD = PRBMathUD60x18Typed.sub(apyUpperUD, fixedRateUD);
            rateDeltaUD = rateDeltaUD.value > minDeltaLMUD.value ? rateDeltaUD : minDeltaLMUD;
        } else {
            rateDeltaUD = PRBMathUD60x18Typed.sub(PRBMathUD60x18Typed.mul(apyUpperUD, apyUpperMultiplierUD), fixedRateUD);
            rateDeltaUD = rateDeltaUD.value > minDeltaIMUD.value ? rateDeltaUD : minDeltaIMUD;
        }

        PRBMath.UD60x18 memory accrualFactorUD = PRBMath.UD60x18({ value: accrualFact(timePeriodInSeconds) });

        PRBMath.UD60x18 memory marginUD =  PRBMathUD60x18Typed.mul(PRBMathUD60x18Typed.mul(notionalUD, rateDeltaUD), accrualFactorUD);

        margin = marginUD.value;
    
    }


}


