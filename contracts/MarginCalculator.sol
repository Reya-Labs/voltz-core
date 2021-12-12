// SPDX-License-Identifier: MIT

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


/// @title Margin Calculator
/// @notice Margin Calculator Performs the calculations necessary to establish Margin Requirements on Voltz Protocol
contract MarginCalculator is IMarginCalculator{

    /// @dev Upper bound of the underlying pool (e.g. Aave v2 USDC lending pool) APY from the initiation of the IRS AMM and until its maturity
    mapping(bytes32 => PRBMath.UD60x18) internal getApyUpperMultiplier;
    /// @dev Lower bound of the underlying pool (e.g. Aave v2 USDC lending pool) APY from the initiation of the IRS AMM and until its maturity
    mapping(bytes32 => PRBMath.UD60x18) internal getApyLowerMultiplier;
    /// @dev Minimum possible absolute APY delta between the underlying pool and the fixed rate of a given IRS contract, used as a safety measure for Liquidation Margin Computation
    mapping(bytes32 => PRBMath.UD60x18) internal getMinDeltaLM;
    /// @dev Minimum possible absolute APY delta between the underlying pool and the fixed rate of a given IRS contract, used as a safety measure for Initial Margin Computation
    mapping(bytes32 => PRBMath.UD60x18) internal getMinDeltaIM;
    /// @dev Maximum allowed leverage on Voltz Protocol where leverage = (notional traded in an IRS contract) / (margin in the account of an LP/FT/VT)
    mapping(bytes32 => PRBMath.UD60x18) internal getMaxLeverage;
    /// @dev The standard deviation that determines the volatility of the underlying pool APY
    mapping(bytes32 => PRBMath.SD59x18) internal getSigmaSquared;
    /// @dev Margin Engine Parameter estimated via CIR model calibration (for details refer to litepaper), for efficiency insted of storing alpha (from the litepaper), the contract stores 4*alpha
    mapping(bytes32 => PRBMath.SD59x18) internal getAlpha;
    /// @dev Margin Engine Parameter estimated via CIR model calibration (for details refer to litepaper), for efficiency insted of storing beta (from the litepaper), the contract stores 4*beta
    mapping(bytes32 => PRBMath.SD59x18) internal getBeta; // insted of storing beta, store 4*beta
    /// @dev Standard normal critical value used in the computation of the Upper APY Bound of the underlying pool
    mapping(bytes32 => PRBMath.SD59x18) internal getXiUpper;
    /// @dev Standard normal critical value used in the computation of the Lower APY Bound of the underlying pool
    mapping(bytes32 => PRBMath.SD59x18) internal getXiLower;
    /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t) where t is the maturity timestamp, s is the current timestamp and beta is a diffusion process parameter set via calibration
    mapping(bytes32 => mapping(uint256 => PRBMath.SD59x18)) internal timeFactorTimeInSeconds; // rateOralceId --> timeInSeconds --> timeFactor
    /// @dev Seconds in a year
    uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;
    
    /// @notice Calculates an APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param rateOracleId A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
    /// @param timeInSeconds Number of seconds from now until IRS AMM maturity
    /// @param twapApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param isUpper isUpper = true ==> calculating the APY Upper Bound, otherwise APY Lower Bound
    /// @return apyBound APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    function computeApyBound(bytes32 rateOracleId, uint256 timeInSeconds, uint256 twapApy, bool isUpper) internal view returns (uint256 apyBound) {
        
        ApyBoundVars memory apyBoundVars;

        apyBoundVars.timeFactor =  timeFactorTimeInSeconds[rateOracleId][timeInSeconds];
        apyBoundVars.oneMinusTimeFactor = PRBMathSD59x18Typed.sub(
            PRBMath.SD59x18({
                value: 1
            }),
            apyBoundVars.timeFactor
        );

        apyBoundVars.k = PRBMathSD59x18Typed.div(getAlpha[rateOracleId], getSigmaSquared[rateOracleId]);

        apyBoundVars.zeta = PRBMathSD59x18Typed.div(
            PRBMathSD59x18Typed.mul(getSigmaSquared[rateOracleId],apyBoundVars.oneMinusTimeFactor),
            getBeta[rateOracleId]
        );
        
        // todo: fix
        apyBoundVars.lambdaNum = PRBMathSD59x18Typed.mul(PRBMathSD59x18Typed.mul(getBeta[rateOracleId], apyBoundVars.timeFactor), PRBMath.SD59x18({value:int256(twapApy)}));
        apyBoundVars.lambdaDen = PRBMathSD59x18Typed.mul(getBeta[rateOracleId], apyBoundVars.timeFactor);
        apyBoundVars.lambda = PRBMathSD59x18Typed.div(apyBoundVars.lambdaNum, apyBoundVars.lambdaDen);

        apyBoundVars.criticalValueMultiplier = PRBMathSD59x18Typed.mul(PRBMathSD59x18Typed.add(PRBMathSD59x18Typed.mul(PRBMath.SD59x18({value: 2}), apyBoundVars.lambda), apyBoundVars.k), PRBMath.SD59x18({value: 2}));

        apyBoundVars.criticalValue;

        if (isUpper) {
            apyBoundVars.criticalValue = PRBMathSD59x18Typed.sub(
                getXiUpper[rateOracleId],
                PRBMathSD59x18Typed.sqrt(apyBoundVars.criticalValueMultiplier)    
            );            
        } else {
            apyBoundVars.criticalValue = PRBMathSD59x18Typed.sub(
                getXiLower[rateOracleId],
                PRBMathSD59x18Typed.sqrt(apyBoundVars.criticalValueMultiplier)    
            );            
        }

        int256 apyBoundInt = PRBMathSD59x18Typed.mul(apyBoundVars.zeta, PRBMathSD59x18Typed.add(PRBMathSD59x18Typed.add(apyBoundVars.k, apyBoundVars.lambda), apyBoundVars.criticalValue)).value;

        if (apyBoundInt < 0) {
            apyBound = 0;
        } else {
            apyBound = uint256(apyBoundInt);
        }

    }
    
    /// @notice Calculates the Worst Case Variable Factor At Maturity
    /// @param timeInSecondsFromStartToMaturity Duration of a given IRS AMM (18 decimals)
    /// @param timeInSecondsFromNowToMaturity Number of seconds from now to the maturity of a given IRS AMM (18 decimals)
    /// @param isFT isFT => we are dealing with a Fixed Taker (short) IRS position, otherwise it is a Variable Taker (long) IRS position
    /// @param isLM isLM => we are computing a Liquidation Margin otherwise computing an Initial Margin
    /// @param rateOracleId A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
    /// @param twapApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @return variableFactor The Worst Case Variable Factor At Maturity = APY Bound * accrualFactor(timeInYearsFromStartUntilMaturity) where APY Bound = APY Upper Bound for Fixed Takers and APY Lower Bound for Variable Takers
    function worstCaseVariableFactorAtMaturity(uint256 timeInSecondsFromStartToMaturity, uint256 timeInSecondsFromNowToMaturity, bool isFT, bool isLM, bytes32 rateOracleId, uint256 twapApy ) internal view returns(uint256 variableFactor) {
        
        uint256 timeInYearsFromStartUntilMaturity = FixedAndVariableMath.accrualFact(timeInSecondsFromStartToMaturity);

        if (isFT) {

            if (isLM) {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, true)
                    }),

                    PRBMath.UD60x18({
                        value: timeInYearsFromStartUntilMaturity
                    })
                ).value;
            } else {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMathUD60x18Typed.mul(

                        PRBMath.UD60x18({
                            value: computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, true)
                        }),

                        PRBMath.UD60x18({
                            value: getApyUpperMultiplier[rateOracleId].value
                        })
                    ),

                    PRBMath.UD60x18({
                        value: timeInYearsFromStartUntilMaturity
                    })
                ).value;
            }


        } else {
            if (isLM) {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMath.UD60x18({
                        value: computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, false)
                    }),

                    PRBMath.UD60x18({
                        value: timeInYearsFromStartUntilMaturity
                    })
                ).value;
            } else {
                variableFactor = PRBMathUD60x18Typed.mul(

                    PRBMathUD60x18Typed.mul(

                        PRBMath.UD60x18({
                            value: computeApyBound(rateOracleId, timeInSecondsFromNowToMaturity, twapApy, false)
                        }),

                        PRBMath.UD60x18({
                            value: getApyLowerMultiplier[rateOracleId].value
                        })
                    ),

                    PRBMath.UD60x18({
                        value: timeInYearsFromStartUntilMaturity
                    })
                ).value;
            }
        }
    }
    
    /// @inheritdoc IMarginCalculator
    function getMinimumMarginRequirement(
        TraderMarginRequirementParams memory params
    ) public view override returns(uint256 margin) {
    
        MinimumMarginRequirementLocalVars memory vars;
        
        vars.timeInSeconds = PRBMathUD60x18Typed.sub(

            PRBMath.UD60x18({
                value: params.termEndTimestamp
            }),

            PRBMath.UD60x18({
                value: params.termStartTimestamp
            })
        ).value;

        vars.timeInYears = FixedAndVariableMath.accrualFact(vars.timeInSeconds);
        
        if (params.isLM) {
            vars.minDelta = uint256(getMinDeltaLM[params.rateOracleId].value);
        } else {
            vars.minDelta = uint256(getMinDeltaIM[params.rateOracleId].value);
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
                        value: vars.timeInYears
                    })
                )
            ).value;

        } else {
            // variable token balance must be non-negative
            // fixed token balance must be non-positive
            // check that at least one is non-zero

            vars.notional = uint256(params.variableTokenBalance);

            console.log("The fixed factor is", FixedAndVariableMath.fixedFactor(true, params.termStartTimestamp, params.termEndTimestamp));
            console.log("The time in years is", vars.timeInYears);
            
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
                        value: vars.timeInYears
                    })
                )
            ).value;

            if (margin > vars.zeroLowerBoundMargin) {
                margin = vars.zeroLowerBoundMargin;
            }

        }
    }
    
    /// @inheritdoc IMarginCalculator
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params
    ) public view override returns(uint256 margin) {
        
        // todo: analyse scenarios where both are negative, because if both are positive, just return 0
        // todo: only matters if there is a negative balance in either token
        // return 0 in these cases, isLM doesn't matter
        // todo: or check if the signs are different
        // minimum margin needs to be >= 0

        // bool isFT = params.variableTokenBalance < 0;

        uint256 timeInSecondsFromStartToMaturity = PRBMathUD60x18Typed.sub(

                    PRBMath.UD60x18({
                        value: params.termEndTimestamp
                    }),

                    PRBMath.UD60x18({
                        value: params.termStartTimestamp
                    })
        ).value;

        uint256 timeInSecondsFromNowToMaturity = PRBMathUD60x18Typed.sub(

                    PRBMath.UD60x18({
                        value: params.termEndTimestamp
                    }),

                    PRBMath.UD60x18({
                        value: Time.blockTimestampScaled()
                    })
        ).value;

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
                value: int256(worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, params.variableTokenBalance < 0, params.isLM, params.rateOracleId, params.twapApy))
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
                    })
                );

        
            if (vars.marginReqAfterUp > vars.marginReqAfterDown) {
                margin = marginReqAfterUp;
            } else {
                margin = vars.marginReqAfterDown;
            }
    }
    
    /// @inheritdoc IMarginCalculator
    function isLiquidatablePosition(PositionMarginRequirementParams memory params, int256 currentMargin) public view override returns(bool _isLiquidatable) {

        uint256 marginRequirement = getPositionMarginRequirement(params);
        if (currentMargin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }

    }

    /// @inheritdoc IMarginCalculator
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
    
    /// @inheritdoc IMarginCalculator
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
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
                        isLM: params.isLM,
                        rateOracleId: params.rateOracleId,
                        twapApy: params.twapApy
                    })
                );
                
            }
            
        }

    }

}