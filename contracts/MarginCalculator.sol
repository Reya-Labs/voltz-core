pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./core_libraries/Position.sol";
import "hardhat/console.sol";
import "./core_libraries/Tick.sol";


contract MarginCalculator is IMarginCalculator{

    // todo: replace the apyUpper and apyLower with the chainlink oracle feed that is custom for each underlying pool 
    uint256 public override apyUpper = 9 * 10**16; // 0.09, 9%
    uint256 public override apyLower = 1 * 10**16; // 0.01, 1%;

    uint256 public override apyUpperMultiplier = 2 * 10**18; // 2.0
    uint256 public override apyLowerMultiplier = 5 * 10**17; // 0.5
    
    

    uint256 public override minDeltaLM = 125 * 10**14; // 0.0125
    uint256 public override minDeltaIM = 500 * 10**14; // 0.05

    uint256 public override constant SECONDS_IN_YEAR = 31536000 * 10**18; // todo: push into library

    uint256 public override maxLeverage = 10 * 10**18; // 10x


    PRBMath.SD59x18 public sigmaSquared; // todo: turn into a mapping based on the rateOracleId
    PRBMath.SD59x18 public  alpha;
    PRBMath.SD59x18 public beta;

    mapping(bytes32 => mapping(uint256 => PRBMath.SD59x18)) internal timeFactorTimeInSeconds; // rateOralceId --> timeInSeconds --> timeFactor

    PRBMath.SD59x18 public xi_upper; // should be negative
    PRBMath.SD59x18 public xi_lower; 

    // insted of storing alpha, store 4*alpha
    // insted of storing beta, store 4*bet
    function compute_apy_bound(bytes32 rateOracleId, uint256 timeInSeconds, int256 apySinceInception, bool isUpper) internal view returns (uint256 apyBound) {

        // todo: isLm check

        PRBMath.SD59x18 memory timeFactor =  timeFactorTimeInSeconds[rateOracleId][timeInSeconds];
        PRBMath.SD59x18 memory oneMinusTimeFactor = PRBMathSD59x18Typed.sub(
            PRBMath.SD59x18({
                value: 1
            }),
            timeFactor
        );

        PRBMath.SD59x18 memory k = PRBMathSD59x18Typed.div(alpha, sigmaSquared);

        PRBMath.SD59x18 memory zeta = PRBMathSD59x18Typed.div(
            PRBMathSD59x18Typed.mul(sigmaSquared,oneMinusTimeFactor),
            beta
        );

        PRBMath.SD59x18 memory lambda_num = PRBMathSD59x18Typed.mul(PRBMathSD59x18Typed.mul(beta, timeFactor), PRBMath.SD59x18({value:apySinceInception}));
        PRBMath.SD59x18 memory lambda_den = PRBMathSD59x18Typed.mul(beta, timeFactor);
        PRBMath.SD59x18 memory lambda = PRBMathSD59x18Typed.div(lambda_num, lambda_den);


        PRBMath.SD59x18 memory criticalValueMultiplier = PRBMathSD59x18Typed.mul(PRBMathSD59x18Typed.add(PRBMathSD59x18Typed.mul(PRBMath.SD59x18({value: 2}), lambda), k), PRBMath.SD59x18({value: 2}));

        PRBMath.SD59x18 memory criticalValue;

        if (isUpper) {
            criticalValue = PRBMathSD59x18Typed.sub(
                xi_upper,
                PRBMathSD59x18Typed.sqrt(criticalValueMultiplier)    
            );            
        } else {
            criticalValue = PRBMathSD59x18Typed.sub(
                xi_lower,
                PRBMathSD59x18Typed.sqrt(criticalValueMultiplier)    
            );            
        }

        
        int256 apyBoundInt = PRBMathSD59x18Typed.mul(zeta, PRBMathSD59x18Typed.add(PRBMathSD59x18Typed.add(k, lambda), criticalValue)).value;

        if (apyBoundInt < 0) {
            apyBound = 0;
        } else {
            apyBound = uint256(apyBoundInt);
        }

    }
    
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
        
        // todo: analyse scenarios where both are negative, because if both are positive, just return 0
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

    struct PositionMarginRequirementsVars {

        int256 amount0;
        int256 amount1;

        int256 expectedVariableTokenBalance;
        int256 expectedFixedTokenBalance;

        int256 amount0Up;
        int256 amount1Up;

        int256 amount0Down;
        int256 amount1Down;

        int256 expectedVariableTokenBalanceAfterUp;
        int256 expectedFixedTokenBalanceAfterUp;

        int256 expectedVariableTokenBalanceAfterDown;
        int256 expectedFixedTokenBalanceAfterDown;

        uint256 marginReqAfterUp;
        uint256 marginReqAfterDown;

        int256 margin;

    }

    function positionMarginBetweenTicksHelper(PositionMarginRequirementParams memory params, PositionMarginRequirementsVars memory vars) internal view returns (uint256 margin) {

            // going up balance delta
            // todo: make sure the signs are correct
            vars.amount0Up = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(params.currentTick),
                TickMath.getSqrtRatioAtTick(params.tickUpper),
                int128(params.liquidity)
            );
            vars.amount1Up = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(params.currentTick),
                TickMath.getSqrtRatioAtTick(params.tickUpper),
                int128(params.liquidity)
            );

            // todo: convert to uints in here
            
            vars.expectedVariableTokenBalanceAfterUp = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: params.variableTokenBalance
                }),

                PRBMath.SD59x18({
                    value: -int256(vars.amount1Up)
                })

            ).value;

            vars.expectedFixedTokenBalanceAfterUp = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: params.fixedTokenBalance
                }),

                PRBMath.SD59x18({
                    // value: -int256(FixedAndVariableMath.getFixedTokenBalance(uint256(vars.amount0Up), uint256(vars.amount1Up), int256(variableFactor(false)), false, termStartTimestamp, termEndTimestamp))
                    value: FixedAndVariableMath.getFixedTokenBalance(vars.amount0Up, vars.amount1Up, params.variableFactor, params.termStartTimestamp, params.termEndTimestamp)

                })

            ).value;

            uint256 marginReqAfterUp = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterUp,
                        variableTokenBalance: vars.expectedVariableTokenBalanceAfterUp,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            // going down balance delta
            vars.amount0Down = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(params.tickLower),
                TickMath.getSqrtRatioAtTick(params.currentTick),
                int128(params.liquidity)
            );

            vars.amount1Down = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(params.tickLower),
                TickMath.getSqrtRatioAtTick(params.currentTick),
                int128(params.liquidity)
            );

            // todo: fix the signs and convert to uint

            vars.expectedVariableTokenBalanceAfterDown = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: params.variableTokenBalance
                }),

                PRBMath.SD59x18({
                    value: -int256(vars.amount1Down)
                })

            ).value;

            vars.expectedFixedTokenBalanceAfterDown = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: params.fixedTokenBalance
                }),

                PRBMath.SD59x18({
                    value: FixedAndVariableMath.getFixedTokenBalance(vars.amount0Down, vars.amount1Down, params.variableFactor, params.termStartTimestamp, params.termEndTimestamp)
                })

            ).value;

            vars.marginReqAfterDown = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterDown,
                        variableTokenBalance: vars.expectedVariableTokenBalanceAfterDown,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );

        
            if (vars.marginReqAfterUp > vars.marginReqAfterDown) {
                margin = marginReqAfterUp;
            } else {
                margin = vars.marginReqAfterDown;
            }
    }
    
    

    function isLiquidatablePosition(PositionMarginRequirementParams memory params, int256 currentMargin) public view override returns(bool _isLiquidatable) {

        uint256 marginRequirement = getPositionMarginRequirement(params);
        if (currentMargin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }

    }

    function isLiquidatableTrader(
        TraderMarginRequirementParams memory params,
        int256 currentMargin
    ) public view override returns(bool isLiquidatable) {

        // todo: liquidation only supported by accounts that are not fully collateralised
        // todo: cannot liquidate expired position?

        uint256 marginRequirement = getTraderMarginRequirement(params);
     
        if (currentMargin < int256(marginRequirement)) {
            isLiquidatable = true;
        } else {
            isLiquidatable = false;
        }
    
    }
    

    function getPositionMarginRequirement(PositionMarginRequirementParams memory params) public view override returns (uint256 margin) {

        // todo: check if position's liqudity delta is not zero

        PositionMarginRequirementsVars memory vars;

        vars.amount0 = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            int128(params.liquidity)
        );
    
        vars.amount1 = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            int128(params.liquidity)
        );

        // tood: fix amount signs and convert to uint256
        
        if (params.currentTick < params.tickLower) {

            if (params.variableTokenBalance > 0) {
                revert(); // this should not be possible
            } else if (params.variableTokenBalance < 0) {
                // means the trader deposited on the other side of the tick rang
                // the margin just covers the current balances of the position
                
                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: params.fixedTokenBalance,
                        variableTokenBalance: params.variableTokenBalance,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            } else {
                // the variable token balance is 0
                vars.expectedVariableTokenBalance = int256(vars.amount1);
                vars.expectedFixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(vars.amount0, vars.amount1, params.variableFactor, params.termStartTimestamp, params.termEndTimestamp);

                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            }

        } else if (params.currentTick < params.tickUpper) {
            
            margin = positionMarginBetweenTicksHelper(params, vars);

        } else {

            if (params.variableTokenBalance < 0) {
                revert(); // this should not be possible
            } else if (params.variableTokenBalance > 0) {
                // means the trader deposited on the other side of the tick rang
                // the margin just covers the current balances of the position
                
                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: params.fixedTokenBalance,
                        variableTokenBalance: params.variableTokenBalance,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            } else {
                // the variable token balance is 0
                vars.expectedVariableTokenBalance = -int256(vars.amount1);
                vars.expectedFixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(vars.amount0, vars.amount1, params.variableFactor, params.termStartTimestamp, params.termEndTimestamp);
                // todo: params.rateOracle.variableFactor(false, params.underlyingToken, params.termStartTimestamp, params.termEndTimestamp)
  
                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp:params.termStartTimestamp,
                        termEndTimestamp:params.termEndTimestamp,
                        isLM: params.isLM
                    })
                );
                
            }
            
        }

    }

}
