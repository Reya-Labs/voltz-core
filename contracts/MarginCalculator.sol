pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./core_libraries/Position.sol";


contract MarginCalculator is IMarginCalculator{

    // todo: replace the apyUpper and apyLower with the 
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
        TraderMarginRequirementParams memory params,
        bool isFT
    ) public view returns(uint256 margin) {
        // todo: for vts there needs to be a zero lower bound --> so need to have an idea of the underlying fixed rate
        uint256 timePeriodInYears = FixedAndVariableMath.accrualFact(params.termEndTimestamp-params.termStartTimestamp);
        uint256 minDelta;
        uint256 notional;
        
        if (params.isLM) {
            minDelta = minDeltaLM;
        } else {
            minDelta = minDeltaIM;
        }

        if (isFT) {
            // variable token balance must be negative
            notional = uint256(-params.variableTokenBalance);
            
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
            notional = uint256(params.variableTokenBalance);

            uint256 zeroLowerBoundMargin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: uint256(-params.fixedTokenBalance)
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp)
                    }),

                    PRBMath.UD60x18({
                        value: timePeriodInYears
                    })
                )
            ).value;

            margin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: uint256(params.variableTokenBalance)
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
        uint160 sqrtRatioLower,
        uint160 sqrtRatioUpper,
        uint128 liquidity
    ) internal pure returns(uint256 fixedTokenBalance, uint256 variableTokenBalance) {
        
        // todo: (explain and document the logic) worst cast assumption is that we assume that the LP enters into worst case FT or VT trade
        
        fixedTokenBalance = SqrtPriceMath.getAmount0Delta(
            sqrtRatioLower,
            sqrtRatioUpper,
            liquidity,
            true
        );
        
        variableTokenBalance = SqrtPriceMath.getAmount1Delta(
            sqrtRatioLower,
            sqrtRatioUpper,
            liquidity,
            true
        );

    }
    
    
    function maxMarginReq(
        TraderMarginRequirementParams memory params
        ) internal returns(uint256 margin) {
        
        uint256 marginReqFT = getTraderMarginRequirement(
            params
        );

        uint256 marginReqVT = getTraderMarginRequirement(
            params
        );

        if (marginReqFT > marginReqVT) {
            margin = uint256(marginReqFT);
        } else{
            margin = uint256(marginReqVT);
        }

    }
    
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params
    ) public view override returns(uint256 margin) {
        
        // todo: only matters if there is a negative balance in either token
        // return 0 in these cases, isLM doesn't matter

        bool isFT = params.variableTokenBalance < 0;

        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: params.fixedTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp))
            })
        );

        PRBMath.SD59x18 memory exp2 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: params.variableTokenBalance
            }),

            // todo: safemath?
            PRBMath.SD59x18({
                value: int256(worstCaseVariableFactorAtMaturity(params.termEndTimestamp-params.termStartTimestamp, isFT, params.isLM))
            })
        );

        margin = uint256(PRBMathSD59x18Typed.add(exp1, exp2).value);

        uint256 minimumMargin = getMinimumMarginRequirement(
                                    params,
                                    isFT
                                );
        if (margin < minimumMargin) {
            margin = minimumMargin;
        }

    }

}
