pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";


contract MarginCalculator is IMarginCalculator{

    uint256 public override apyUpper = 9 * 10**16; // 0.09, 9%
    uint256 public override apyLower = 1 * 10**16; // 0.01, 1%;

    uint256 public override apyUpperMultiplier = 2 * 10**18; // 2.0
    uint256 public override apyLowerMultiplier = 5 * 10**17; // 0.5

    uint256 public override minDeltaLM = 125 * 10**14; // 0.00125
    uint256 public override minDeltaIM = 500 * 10**14; // 0.05

    uint256 public override constant SECONDS_IN_YEAR = 31536000 * 10**18;

    // todo: make the function internal
    function accrualFact(uint256 timePeriodInSeconds)
        public
        override
        pure
        returns (uint256 timePeriodInYears)
    {
        PRBMath.UD60x18 memory xUD = PRBMath.UD60x18({
            value: timePeriodInSeconds
        });
        PRBMath.UD60x18 memory yUD = PRBMath.UD60x18({value: SECONDS_IN_YEAR});

        timePeriodInYears = PRBMathUD60x18Typed.div(xUD, yUD).value;
    }

    function tickRangeNotionalFixedRate(
        uint160 sqrtRatio,
        uint256 amountInp,
        bool isFT
    )
        public
        pure
        returns (
            PRBMath.UD60x18 memory notionalUD,
            PRBMath.UD60x18 memory fixedRateUD
        )
    {

        fixedRateUD = PRBMathUD60x18Typed.div(
                
                PRBMath.UD60x18({
                    value: 10**16 // one percent
                }),
                
                PRBMath.UD60x18({
                    value: sqrtRatio
                })
        );        
        
        if (isFT) {
            // then amount1 is positive
            notionalUD = PRBMath.UD60x18({
                value: amountInp
            });

        } else {
            notionalUD = PRBMathUD60x18Typed.mul(
                
                PRBMath.UD60x18({
                    value: amountInp
                }),
                
                PRBMath.UD60x18({
                    value: sqrtRatio
                })
        );        

        } 
        
    }

    // function getUnwindSettlementCashflow(
    //     int256 notionalS,
    //     int256 fixedRateS,
    //     int256 notionalU,
    //     int256 fixedRateU,
    //     uint256 timePeriodInSeconds
    // ) public override view returns (int256 cashflow) {

    //     // todo: require notionalS to be equal to notionalU --> otherwise DUST... 

    //     PRBMath.SD59x18 memory fixedRateDelta = PRBMathSD59x18Typed.sub(

    //         PRBMath.SD59x18({
    //             value: fixedRateS
    //         }),

    //         PRBMath.SD59x18({
    //             value: fixedRateU
    //         })
    //     );

    //     uint256 timePeriodInYears = accrualFact(timePeriodInSeconds);


    //     cashflow = PRBMathSD59x18Typed.mul(
    //         PRBMath.SD59x18({
    //             value: notionalS // todo: make sure this value is correctly set
    //         }),
    //         PRBMathSD59x18Typed.mul(
    //             fixedRateDelta,
    //             PRBMath.SD59x18({
    //                 value: int256(timePeriodInYears)
    //             })
    //         )
    //     ).value;

    // }
    
    
    function getLPMarginReqWithinTickRangeDeposit(
        PRBMath.UD60x18 memory notionalVTUD,
        PRBMath.UD60x18 memory fixedRateVTUD,
        PRBMath.UD60x18 memory notionalFTUD,
        PRBMath.UD60x18 memory fixedRateFTUD,
        uint256 timePeriodInSeconds,
        bool isLM
    ) public view returns (PRBMath.UD60x18 memory marginUD) {
        uint256 marginReqFTLM = getFTMarginRequirement(
            notionalFTUD.value,
            fixedRateFTUD.value,
            timePeriodInSeconds,
            isLM
        );
        uint256 marginReqVTLM = getVTMarginRequirement(
            notionalVTUD.value,
            fixedRateVTUD.value,
            timePeriodInSeconds,
            isLM
        );

        if (marginReqFTLM > marginReqVTLM) {
            marginUD = PRBMath.UD60x18({value: marginReqFTLM});
        } else {
            marginUD = PRBMath.UD60x18({value: marginReqVTLM});
        }
    }


    function getLPMarginRequirement(
        uint160 sqrtRatioLower,
        uint160 sqrtRatioUpper,
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtRatioCurr,
        uint256 timePeriodInSeconds,
        bool isLM
    ) external override view returns (uint256 margin) {
        PRBMath.UD60x18 memory notionalUD;
        PRBMath.UD60x18 memory fixedRateUD;
        PRBMath.UD60x18 memory marginUD;

        if (sqrtRatioCurr < sqrtRatioLower) {
            // LP is a variable taker
            (notionalUD, fixedRateUD) = tickRangeNotionalFixedRate(
                sqrtRatioLower,
                amount0,
                false
            );
            marginUD = PRBMath.UD60x18({
                value: getVTMarginRequirement(
                    notionalUD.value,
                    fixedRateUD.value,
                    timePeriodInSeconds,
                    isLM
                )
            });
        } else if (sqrtRatioCurr < sqrtRatioUpper) {
            (
                PRBMath.UD60x18 memory notionalVTUD,
                PRBMath.UD60x18 memory fixedRateVTUD
            ) = tickRangeNotionalFixedRate(
                    sqrtRatioCurr,
                    // sqrtRatioUpper,
                    amount0,
                    // amount1
                    false
                );
            (
                PRBMath.UD60x18 memory notionalFTUD,
                PRBMath.UD60x18 memory fixedRateFTUD
            ) = tickRangeNotionalFixedRate(
                    // sqrtRatioLower,
                    sqrtRatioCurr,
                    amount1,
                    true
                );

            marginUD = getLPMarginReqWithinTickRangeDeposit(notionalVTUD, 
                                                            fixedRateVTUD, 
                                                            notionalFTUD, 
                                                            fixedRateFTUD, 
                                                            timePeriodInSeconds, 
                                                            isLM);
        } else {
            (notionalUD, fixedRateUD) = tickRangeNotionalFixedRate(
                // sqrtRatioLower,
                sqrtRatioUpper,
                amount1,
                true
            );
            marginUD = PRBMath.UD60x18({
                value: getFTMarginRequirement(
                    notionalUD.value,
                    fixedRateUD.value,
                    timePeriodInSeconds,
                    isLM
                )
            });
        }

        margin = marginUD.value;
    }

    function getFTMarginRequirement(
        uint256 notional,
        uint256 fixedRate,
        uint256 timePeriodInSeconds,
        bool isLM
    ) public override view returns (uint256 margin) {
        // todo: only load vars in the if statements for optimisation
        PRBMath.UD60x18 memory notionalUD = PRBMath.UD60x18({value: notional});
        PRBMath.UD60x18 memory fixedRateUD = PRBMath.UD60x18({
            value: fixedRate
        });

        PRBMath.UD60x18 memory apyUpperUD = PRBMath.UD60x18({value: apyUpper});

        PRBMath.UD60x18 memory apyUpperMultiplierUD = PRBMath.UD60x18({
            value: apyUpperMultiplier
        });

        PRBMath.UD60x18 memory minDeltaLMUD = PRBMath.UD60x18({
            value: minDeltaLM
        });
        PRBMath.UD60x18 memory minDeltaIMUD = PRBMath.UD60x18({
            value: minDeltaIM
        });

        PRBMath.UD60x18 memory rateDeltaUD;

        if (isLM) {
            rateDeltaUD = PRBMathUD60x18Typed.sub(apyUpperUD, fixedRateUD);
            rateDeltaUD = rateDeltaUD.value > minDeltaLMUD.value
                ? rateDeltaUD
                : minDeltaLMUD;
        } else {
            rateDeltaUD = PRBMathUD60x18Typed.sub(
                PRBMathUD60x18Typed.mul(apyUpperUD, apyUpperMultiplierUD),
                fixedRateUD
            );
            rateDeltaUD = rateDeltaUD.value > minDeltaIMUD.value
                ? rateDeltaUD
                : minDeltaIMUD;
        }

        PRBMath.UD60x18 memory accrualFactorUD = PRBMath.UD60x18({
            value: accrualFact(timePeriodInSeconds)
        });

        PRBMath.UD60x18 memory marginUD = PRBMathUD60x18Typed.mul(
            PRBMathUD60x18Typed.mul(notionalUD, rateDeltaUD),
            accrualFactorUD
        );

        margin = marginUD.value;
    }

    function getVTMarginRequirement(
        uint256 notional,
        uint256 fixedRate,
        uint256 timePeriodInSeconds,
        bool isLM
    ) public override view returns (uint256 margin) {
        // todo: only load vars in the if statements for optimisation
        PRBMath.UD60x18 memory notionalUD = PRBMath.UD60x18({value: notional});
        PRBMath.UD60x18 memory fixedRateUD = PRBMath.UD60x18({
            value: fixedRate
        });

        PRBMath.UD60x18 memory apyLowerUD = PRBMath.UD60x18({value: apyLower});

        PRBMath.UD60x18 memory apyLowerMultiplierUD = PRBMath.UD60x18({
            value: apyLowerMultiplier
        });

        PRBMath.UD60x18 memory minDeltaLMUD = PRBMath.UD60x18({
            value: minDeltaLM
        });
        PRBMath.UD60x18 memory minDeltaIMUD = PRBMath.UD60x18({
            value: minDeltaIM
        });

        PRBMath.UD60x18 memory rateDeltaUD;

        if (isLM) {
            rateDeltaUD = PRBMathUD60x18Typed.sub(fixedRateUD, apyLowerUD);
            rateDeltaUD = rateDeltaUD.value > minDeltaLMUD.value
                ? rateDeltaUD
                : minDeltaLMUD;
        } else {
            rateDeltaUD = PRBMathUD60x18Typed.sub(
                fixedRateUD,
                PRBMathUD60x18Typed.mul(apyLowerUD, apyLowerMultiplierUD)
            );
            rateDeltaUD = rateDeltaUD.value > minDeltaIMUD.value
                ? rateDeltaUD
                : minDeltaIMUD;
        }

        PRBMath.UD60x18 memory accrualFactorUD = PRBMath.UD60x18({
            value: accrualFact(timePeriodInSeconds)
        });

        PRBMath.UD60x18 memory marginUD = PRBMathUD60x18Typed.mul(
            PRBMathUD60x18Typed.mul(notionalUD, rateDeltaUD),
            accrualFactorUD
        );

        margin = marginUD.value;
    }
}
