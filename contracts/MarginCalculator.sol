pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";
import "./core_libraries/FixedAndVariableMath.sol";


contract MarginCalculator is IMarginCalculator{

    uint256 public override apyUpper = 9 * 10**16; // 0.09, 9%
    uint256 public override apyLower = 1 * 10**16; // 0.01, 1%;

    uint256 public override apyUpperMultiplier = 2 * 10**18; // 2.0
    uint256 public override apyLowerMultiplier = 5 * 10**17; // 0.5

    uint256 public override minDeltaLM = 125 * 10**14; // 0.00125
    uint256 public override minDeltaIM = 500 * 10**14; // 0.05

    uint256 public override constant SECONDS_IN_YEAR = 31536000 * 10**18; // todo: push into library

    uint256 public override maxLeverage = 10 * 10**18; // 10x

    function worstCaseVariableFactorAtMaturity(uint256 timePeriodInSeconds, bool isFT, bool isLM) internal view returns(uint256 variableFactor) {
        
        uint256 timePeriodInYears = FixedAndVariableMath.accrualFact(timePeriodInSeconds);

        if (isFT) {

            if (isLM) {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: apyUpper
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                ).value;
            } else {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMathUD60x18Typed.mul(

                        PRBMath.UD60x18({
                            value: apyUpper
                        }),

                        PRBMath.UD60x18({
                            value: apyUpperMultiplier
                        })
                    ),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                ).value;
            }


        } else {
            if (isLM) {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: apyLower
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                ).value;
            } else {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMathUD60x18Typed.mul(

                        PRBMath.UD60x18({
                            value: apyLower
                        }),

                        PRBMath.UD60x18({
                            value: apyLowerMultiplier
                        })
                    ),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                ).value;
            }
        }
    }


    function getMinimumMarginRequirement(
        int256 variableTokenBalance,
        int256 fixedTokenBalance,
        uint256 fixedFactorFromNowToMaturity,
        uint256 timePeriodInSeconds,
        bool isFT,
        bool isLM
    ) public view returns(uint256 margin) {
        // todo: for vts there needs to be a zero lower bound --> so need to have an idea of the underlying fixed rate
        uint256 timePeriodInYears = FixedAndVariableMath.accrualFact(timePeriodInSeconds);
        uint256 minDelta;
        uint256 notional;
        
        if (isLM) {
            minDelta = minDeltaLM;
        } else {
            minDelta = minDeltaIM;
        }

        if (isFT) {
            // variable token balance must be negative
            notional = uint256(-variableTokenBalance);
            
            margin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: notional
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: minDelta
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                )
            ).value;

        } else {
            // variable token balance must be positive
            // fixed token balance must be negative
            notional = uint256(variableTokenBalance);

            uint256 zeroLowerBoundMargin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: uint256(-fixedTokenBalance)
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: fixedFactorFromNowToMaturity
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                )
            ).value;

            margin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: uint256(variableTokenBalance)
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: minDelta
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                )
            ).value;

            if (margin > zeroLowerBoundMargin) {
                margin = zeroLowerBoundMargin;
            }

        }
    }

    function tickRangeFixedAndVariableBalance(
        uint160 ratio,
        uint256 amountInp,
        bool isFT
    ) internal pure returns(uint256 fixedTokenBalance, uint256 variableTokenBalance) {
        // both positive
        // variableTokenBalance / fixedTokenBalance = sqrtRatio^2  (ratio)
        
        if (isFT) {
            variableTokenBalance = amountInp;
            fixedTokenBalance = PRBMathUD60x18Typed.div(
                
                PRBMath.UD60x18({
                    value: variableTokenBalance
                }),
                
                PRBMath.UD60x18({
                    value: ratio
                })
            ).value;        

        } else {
            fixedTokenBalance = amountInp;
            variableTokenBalance = PRBMathUD60x18Typed.mul(
                
                PRBMath.UD60x18({
                    value: fixedTokenBalance
                }),
                
                PRBMath.UD60x18({
                    value: ratio
                })
            ).value;        
        }

    }
    
    
    struct LPMarginBetweenTicksParams {
        uint256 fixedTokenBalanceVT;
        uint256 variableTokenBalanceVT;
        uint256 fixedTokenBalanceFT;
        uint256 variableTokenBalanceFT;
        uint256 marginReqFT;
        uint256 marginReqVT;
    }
    
    
    function getLPMarginRequirementBetweenTicks(
        uint256 timePeriodInSeconds,
        bool isLM,
        int256 fixedFactorAtMaturity,
        uint256 fixedFactorFromNowToMaturity,
        LPMarginParams memory params
    ) internal returns(uint256 margin) {
        
        LPMarginBetweenTicksParams memory betweenTickParams;

        (betweenTickParams.fixedTokenBalanceVT, betweenTickParams.variableTokenBalanceVT) = tickRangeFixedAndVariableBalance(
                params.ratioCurr,
                params.amount0,
                false
            );

        (betweenTickParams.fixedTokenBalanceFT, betweenTickParams.variableTokenBalanceFT) = tickRangeFixedAndVariableBalance(
            params.ratioCurr,
            params.amount1,
            true
        );

        betweenTickParams.marginReqFT = uint256(getTraderMarginRequirement(
              int256(betweenTickParams.fixedTokenBalanceFT),
              -int256(betweenTickParams.variableTokenBalanceFT),
              fixedFactorAtMaturity, 
              fixedFactorFromNowToMaturity, 
              timePeriodInSeconds, 
              isLM)
        );


        betweenTickParams.marginReqVT = uint256(getTraderMarginRequirement(
              -int256(betweenTickParams.fixedTokenBalanceVT),
              int256(betweenTickParams.variableTokenBalanceVT),
              fixedFactorAtMaturity, 
              fixedFactorFromNowToMaturity, 
              timePeriodInSeconds, 
              isLM)
        );


        if (betweenTickParams.marginReqFT > betweenTickParams.marginReqVT) {
            margin = betweenTickParams.marginReqFT;
        } else {
            margin = betweenTickParams.marginReqVT;
        }

    }


    function getLPMarginRequirement(
        LPMarginParams memory params
    ) public override returns(uint256 margin) {
          
        if (params.ratioCurr < params.ratioLower) {
            // LP is a variable taker
                
            (uint256 fixedTokenBalance, uint256 variableTokenBalance) = tickRangeFixedAndVariableBalance(
                params.ratioLower,
                params.amount0,
                false
            );
            
            // calculate the correct amounts (like in the swap function --> shared function --> put into library)
            int256 fixedTokenBalanceAdjusted = FixedAndVariableMath.getFixedTokenBalance(
                fixedTokenBalance,
                variableTokenBalance,
                params.accruedVariableFactor,
                false,
                params.termStartTimestamp,
                params.termEndTimestamp
            );
            
            // change signs in here
            margin = getTraderMarginRequirement(
                        -fixedTokenBalanceAdjusted, 
                        int256(variableTokenBalance), 
                        int256(FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp)),
                        FixedAndVariableMath.fixedFactor(false, params.termStartTimestamp, params.termEndTimestamp),
                        params.timePeriodInSeconds, 
                        params.isLM
                    );
           
        } else if (params.ratioCurr < params.ratioUpper) {
            
            margin = getLPMarginRequirementBetweenTicks(
                // fixedTokenBalanceVT,
                // variableTokenBalanceVT,
                // fixedTokenBalanceFT,
                // variableTokenBalanceFT,
                params.timePeriodInSeconds,
                params.isLM,
                int256(FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp)),
                FixedAndVariableMath.fixedFactor(false, params.termStartTimestamp, params.termEndTimestamp),
                params
            );
        
        } else {
            
            // LP is a fixed taker

            (uint256 fixedTokenBalance, uint256 variableTokenBalance) = tickRangeFixedAndVariableBalance(
                params.ratioUpper,
                params.amount1,
                true
            );
            
            // calculate the correct amounts (like in the swap function --> shared function --> put into library)
            int256 fixedTokenBalanceAdjusted = FixedAndVariableMath.getFixedTokenBalance(fixedTokenBalance, variableTokenBalance, params.accruedVariableFactor, false, params.termStartTimestamp, params.termEndTimestamp);
            
            // change signs in here
            margin = getTraderMarginRequirement(
                        fixedTokenBalanceAdjusted, 
                        -int256(variableTokenBalance), 
                        int256(FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp)),
                        FixedAndVariableMath.fixedFactor(false, params.termStartTimestamp, params.termEndTimestamp),
                        params.timePeriodInSeconds, 
                        params.isLM
            );

        }   
         
    }
    
    function getTraderMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance, 
        int256 fixedFactorAtMaturity,
        uint256 fixedFactorFromNowToMaturity,
        uint256 timePeriodInSeconds,
        bool isLM
    ) public override returns(uint256 margin) {
        
        // todo: only matters if there is a negative balance in either token
        // return 0 in these cases, isLM doesn't matter

        bool isFT = variableTokenBalance < 0;

        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: fixedTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(fixedFactorAtMaturity)
            })
        );

        PRBMath.SD59x18 memory exp2 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: variableTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(worstCaseVariableFactorAtMaturity(timePeriodInSeconds, isFT, isLM))
            })
        );

        margin = uint256(PRBMathSD59x18Typed.add(exp1, exp2).value);

        uint256 minimumMargin = getMinimumMarginRequirement(
                                    variableTokenBalance,
                                    fixedTokenBalance,
                                    fixedFactorFromNowToMaturity,
                                    timePeriodInSeconds,
                                    isFT,
                                    isLM
                                );
        if (margin < minimumMargin) {
            margin = minimumMargin;
        }

    }

}
