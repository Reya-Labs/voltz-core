pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./core_libraries/Position.sol";
import "hardhat/console.sol";


contract MarginCalculator is IMarginCalculator{

    // todo: replace the apyUpper and apyLower with the 
    uint256 public override apyUpper = 9 * 10**16; // 0.09, 9%
    uint256 public override apyLower = 1 * 10**16; // 0.01, 1%;

    uint256 public override apyUpperMultiplier = 2 * 10**18; // 2.0
    uint256 public override apyLowerMultiplier = 5 * 10**17; // 0.5

    uint256 public override minDeltaLM = 125 * 10**14; // 0.0125
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


    struct MinimumMarginRequirementLocalVars {

        uint256 minDelta;
        uint256 notional;
        uint256 timePeriodInSeconds;
        uint256 timePeriodInYears;
        uint256 zeroLowerBoundMargin;

    }
    
    function getMinimumMarginRequirement(
        TraderMarginRequirementParams memory params
    ) public view returns(uint256 margin) {
        // todo: for vts there needs to be a zero lower bound --> so need to have an idea of the underlying fixed rate
        // todo: check signs

        MinimumMarginRequirementLocalVars memory vars;
        
        vars.timePeriodInSeconds = PRBMathUD60x18Typed.sub(

            PRBMath.UD60x18({
                value: params.termEndTimestamp
            }),

            PRBMath.UD60x18({
                value: params.termStartTimestamp
            })
        ).value;

        vars.timePeriodInYears = FixedAndVariableMath.accrualFact(vars.timePeriodInSeconds);
        
        if (params.isLM) {
            vars.minDelta = minDeltaLM;
        } else {
            vars.minDelta = minDeltaIM;
        }

        if (params.variableTokenBalance < 0) {
            // variable token balance must be negative
            vars.notional = uint256(-params.variableTokenBalance);
            
            margin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: vars.notional
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: vars.minDelta
                    }),

                    PRBMath.UD60x18({
                        value: vars.timePeriodInYears
                    })
                )
            ).value;

        } else {
            // variable token balance must be non-negative
            // fixed token balance must be non-positive
            // check that at least one is non-zero

            vars.notional = uint256(params.variableTokenBalance);

            console.log("The fixed factor is", FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp));
            console.log("The time in years is", vars.timePeriodInYears);
            
            vars.zeroLowerBoundMargin = PRBMathUD60x18Typed.mul(
                PRBMath.UD60x18({
                    value: uint256(-params.fixedTokenBalance)
                }),

                PRBMath.UD60x18({
                        value: FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp)
                })
            ).value;

            margin = PRBMathUD60x18Typed.mul(

                PRBMath.UD60x18({
                    value: vars.notional
                }),

                PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: vars.minDelta
                    }),

                    PRBMath.UD60x18({
                        value: vars.timePeriodInYears
                    })
                )
            ).value;

            if (margin > vars.zeroLowerBoundMargin) {
                margin = vars.zeroLowerBoundMargin;
            }

        }
    }
    
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params
    ) public view override returns(uint256 margin) {
        
        // todo: only matters if there is a negative balance in either token
        // return 0 in these cases, isLM doesn't matter
        // todo: or check if the signs are different
        // minimum margin needs to be >= 0

        bool isFT = params.variableTokenBalance < 0;

        uint256 timePeriodInSeconds = PRBMathUD60x18Typed.sub(

                    PRBMath.UD60x18({
                        value: params.termEndTimestamp
                    }),

                    PRBMath.UD60x18({
                        value: params.termStartTimestamp
                    })
        ).value;


        console.log("The fixed factor is", FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp));
        console.log("TimePeriodInSeconds is", timePeriodInSeconds);
        console.log("Worst Case Var Factor is", worstCaseVariableFactorAtMaturity(timePeriodInSeconds, isFT, params.isLM));
        // console.log(int256(worstCaseVariableFactorAtMaturity(timePeriodInSeconds, isFT, params.isLM)));
        // console.log("Variable Token Balance is", params.variableTokenBalance);
        // console.log("Fixed Token Balance is", params.fixedTokenBalance);

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

            PRBMath.SD59x18({
                value: int256(worstCaseVariableFactorAtMaturity(timePeriodInSeconds, isFT, params.isLM))
            })
        );

        int256 modelMargin = PRBMathSD59x18Typed.add(exp1, exp2).value;

        int256 minimumMargin = int256(getMinimumMarginRequirement(
                                    params
                                ));
        if (modelMargin < minimumMargin) {
            margin = uint256(minimumMargin);
        } else {
            margin = uint256(modelMargin);
        }

    }

}
