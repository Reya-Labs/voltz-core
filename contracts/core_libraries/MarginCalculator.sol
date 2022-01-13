// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "../utils/TickMath.sol";
import "../utils/SqrtPriceMath.sol";
import "./FixedAndVariableMath.sol";
import "./Position.sol";
import "./Tick.sol";
import "../interfaces/IFactory.sol";
import "../interfaces/IMarginEngine.sol";

/// @title Margin Calculator
/// @notice Margin Calculator Performs the calculations necessary to establish Margin Requirements on Voltz Protocol
library MarginCalculator {
    // structs

    struct ApyBoundVars {
        /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t) where t is the maturity timestamp, s is the current timestamp and beta is a diffusion process parameter set via calibration
        int256 timeFactor;
        /// @dev 1 - timeFactor
        int256 oneMinusTimeFactor;
        /// @dev k = (alpha/sigmaSquared)
        int256 k;
        /// @dev zeta = (sigmaSquared*(1-timeFactor))/beta
        int256 zeta;
        int256 lambdaNum;
        int256 lambdaDen;
        /// @dev lambda = lambdaNum/lambdaDen = (beta*timeFactor)*historicalApy / (sigmaSquared*(1-timeFactor))
        int256 lambda;
        /// @dev critical value from the normal distribution (refer to the litepaper, equations 12 and 13)
        int256 criticalValueMultiplier;
        /// @dev critical value = sqrt(2(k+2*lambda))
        int256 criticalValue;
    }

    struct LPMarginParams {
        /// @dev sqrtRatioLower sqrt(y/x) where y/x is the lowest ratio of virtual variable to fixed tokens in the vAMM at which the LP's position is active
        uint160 sqrtRatioLower;
        /// @dev sqrtRatioUpper sqrt(y/x) where y/x is the highest ratio of virtual variable to fixed tokens in the vAMM at which the LP's position is active
        uint160 sqrtRatioUpper;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev total liquidity deposited by a position
        uint128 liquidity;
        /// @dev timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
    }

    struct TraderMarginRequirementParams {
        /// @dev current fixedToken balance of a given trader
        int256 fixedTokenBalance;
        /// @dev current variableToken balance of a given trader
        int256 variableTokenBalance;
        /// @dev timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
        uint256 historicalApy;
    }

    struct PositionMarginRequirementParams {
        /// @dev Position owner
        address owner;
        /// @dev The lower tick of the position
        int24 tickLower;
        /// @dev The upper tick of the position
        int24 tickUpper;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev Current tick in the Virtual Automated Market Maker
        int24 currentTick;
        /// @dev Timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev Timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
        /// @dev Amount of active liquidity of a position
        uint128 liquidity;
        /// @dev Curren Fixed Token Balance of a position
        /// @dev In order for this value to be up to date, the Position needs to first check what the fixedTokenGrowthInside is within their tick range and then calculate accrued fixedToken flows since the last check
        int256 fixedTokenBalance;
        /// @dev Curren Variabe Token Balance of a position
        int256 variableTokenBalance;
        /// @dev Variable Factor is the variable rate from the IRS AMM initiation and until IRS AMM maturity (when computing margin requirements)
        uint256 variableFactor;
        /// @dev Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
        uint256 historicalApy;
    }

    struct MinimumMarginRequirementLocalVars {
        /// @dev Minimum possible absolute APY delta between the underlying pool and the fixed rate of a given IRS contract, used as a safety measure.
        /// @dev minDelta is different depending on whether we are calculating a Liquidation or an Initial Margin Requirement
        uint256 minDelta;
        /// @dev notional is the absolute value of the variable token balance
        uint256 notional;
        /// @dev timeInSeconds = termEndTimestamp - termStartTimestamp of the IRS AMM
        uint256 timeInSeconds;
        /// @dev timeInYears = timeInSeconds / SECONDS_IN_YEAR (where SECONDS_IN_YEAR=31536000)
        uint256 timeInYears;
        /// @dev Only relevant for Variable Takers, since the worst case scenario for them if the variable rates are at the zero lower bound, assuming the APY in the underlying yield-bearing pool can never be negative
        /// @dev zeroLowerBoundMargin = abs(fixedTokenBalance) * timeInYears * 1%
        uint256 zeroLowerBoundMargin;
    }

    struct PositionMarginRequirementsVars {
        /// @dev virtual 1% fixed tokens supported by the position in a given tick range with a given amount of supplied liquidity
        /// @dev amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioAtLowerTick, sqrtRatioAtUpperTick, positionLiquidity)
        int256 amount0;
        /// @dev virtual variable tokens supported by the position in a given tick range with a given amount of supplied liquidity
        /// @dev amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAtLowerTick, sqrtRatioAtUpperTick, positionLiquidity)
        int256 amount1;
        /// @dev the exepected variable token balance of a liquidity provider if the Voltz traders were to completely consume all of the variable liquidty offered by the LP in a given tick range
        int256 expectedVariableTokenBalance;
        /// @dev the exepected fixed token balance of a liquidity provider if the Voltz traders were to completely consume all of the fixed liquidty offered by the LP in a given tick range
        int256 expectedFixedTokenBalance;
        /// @dev If the current tick is within the tick range boundaries of the position then amount0Up represents the amount0 delta following a trade that pushes the tick to the tickUpper of the position
        int256 amount0Up;
        /// @dev If the current tick is within the tick range boundaries of the position then amount1Up represents the amount1 delta following a trade that pushes the tick to the tickUpper of the position
        int256 amount1Up;
        /// @dev If the current tick is within the tick range boundaries of the position then amount0Down represents the amount0 delta following a trade that pushes the tick to the tickLower of the position
        int256 amount0Down;
        /// @dev If the current tick is within the tick range boundaries of the position then amount1Down represents the amount1 delta following a trade that pushes the tick to the tickLower of the position
        int256 amount1Down;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedVariableTokenBalanceAfterUp is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickUpper of the position
        int256 expectedVariableTokenBalanceAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedFixedTokenBalanceAfterUp is the the exepected fixed token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickUpper of the position
        int256 expectedFixedTokenBalanceAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedVariableTokenBalanceAfterDown is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickLower of the position
        int256 expectedVariableTokenBalanceAfterDown;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedFixedTokenBalanceAfterDown is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickLower of the position
        int256 expectedFixedTokenBalanceAfterDown;
        /// @dev If the current tick is within the tick range boundaries of the position then marginReqAfterUp is the margin requirement (either liquidation or initial) if the traders were to push the tick to the tickUpper of the position
        uint256 marginReqAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then marginReqAfterDown is the margin requirement (either liquidation or initial) if the traders were to push the tick to the tickLower of the position
        uint256 marginReqAfterDown;
        /// @dev Liquidation or Initial Margin Requirement of a Position
        int256 margin;
    }

    int256 public constant ONE_WEI = 10**18;

    /// @dev Seconds in a year
    int256 public constant SECONDS_IN_YEAR = 31536000 * ONE_WEI;

    /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t_max) where t is the maturity timestamp, and t_max is the max number of seconds for the amm duration, s is the current timestamp and beta is a diffusion process parameter set via calibration
    function computeTimeFactor(
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal pure returns (int256 timeFactor) {
        require(termEndTimestampScaled > 0, "termEndTimestamp must be > 0");
        require(
            currentTimestampScaled <= termEndTimestampScaled,
            "endTime must be > currentTime"
        );
        require(
            _marginCalculatorParameters.beta != 0,
            "parameters not set for oracle"
        );

        int256 beta = _marginCalculatorParameters.beta;
        int256 tMax = _marginCalculatorParameters.tMax;

        int256 scaledTime = PRBMathSD59x18.div(
            (int256(termEndTimestampScaled) - int256(currentTimestampScaled)),
            tMax
        );

        int256 expInput = PRBMathSD59x18.mul((-beta), scaledTime);

        timeFactor = PRBMathSD59x18.exp(expInput);
    }

    /// @notice Calculates an APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param termEndTimestampScaled termEndTimestampScaled
    /// @param currentTimestampScaled currentTimestampScaled
    /// @param historicalApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param isUpper isUpper = true ==> calculating the APY Upper Bound, otherwise APY Lower Bound
    /// @return apyBound APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    function computeApyBound(
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled,
        uint256 historicalApy,
        bool isUpper,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 apyBound) {
        ApyBoundVars memory apyBoundVars;

        int256 beta4 = PRBMathSD59x18.mul(
            _marginCalculatorParameters.beta,
            4 * ONE_WEI
        );

        apyBoundVars.timeFactor = computeTimeFactor(
            termEndTimestampScaled,
            currentTimestampScaled,
            _marginCalculatorParameters
        );

        apyBoundVars.oneMinusTimeFactor = ONE_WEI - apyBoundVars.timeFactor;

        apyBoundVars.k = PRBMathSD59x18.div(
            _marginCalculatorParameters.alpha,
            _marginCalculatorParameters.sigmaSquared
        );

        apyBoundVars.zeta = PRBMathSD59x18.div(
            PRBMathSD59x18.mul(
                _marginCalculatorParameters.sigmaSquared,
                apyBoundVars.oneMinusTimeFactor
            ),
            beta4
        );

        apyBoundVars.lambdaNum = PRBMathSD59x18.mul(
            PRBMathSD59x18.mul(beta4, apyBoundVars.timeFactor),
            int256(historicalApy)
        );

        apyBoundVars.lambdaDen = PRBMathSD59x18.mul(
            beta4,
            apyBoundVars.timeFactor
        ); // check the time factor exists, if not have a fallback?
        apyBoundVars.lambda = PRBMathSD59x18.div(
            apyBoundVars.lambdaNum,
            apyBoundVars.lambdaDen
        );

        apyBoundVars.criticalValueMultiplier = PRBMathSD59x18.mul(
            PRBMathSD59x18.mul(2 * (10**18), apyBoundVars.lambda) +
                apyBoundVars.k,
            (2 * (10**18))
        );

        apyBoundVars.criticalValue;

        if (isUpper) {
            apyBoundVars.criticalValue = PRBMathSD59x18.mul(
                _marginCalculatorParameters.xiUpper,
                PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplier)
            );
        } else {
            apyBoundVars.criticalValue = PRBMathSD59x18.mul(
                _marginCalculatorParameters.xiLower,
                PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplier)
            );
        }

        int256 apyBoundInt = PRBMathSD59x18.mul(
            apyBoundVars.zeta,
            apyBoundVars.k + apyBoundVars.lambda + apyBoundVars.criticalValue
        );

        if (apyBoundInt < 0) {
            apyBound = 0;
        } else {
            apyBound = uint256(apyBoundInt);
        }
    }

    /// @notice Calculates the Worst Case Variable Factor At Maturity
    /// @param timeInSecondsFromStartToMaturity Duration of a given IRS AMM (18 decimals)
    /// @param termEndTimestampScaled termEndTimestampScaled
    /// @param currentTimestampScaled currentTimestampScaled
    /// @param isFT isFT => we are dealing with a Fixed Taker (short) IRS position, otherwise it is a Variable Taker (long) IRS position
    /// @param isLM isLM => we are computing a Liquidation Margin otherwise computing an Initial Margin
    /// @param historicalApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @return variableFactor The Worst Case Variable Factor At Maturity = APY Bound * accrualFactor(timeInYearsFromStartUntilMaturity) where APY Bound = APY Upper Bound for Fixed Takers and APY Lower Bound for Variable Takers
    function worstCaseVariableFactorAtMaturity(
        uint256 timeInSecondsFromStartToMaturity,
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled,
        bool isFT,
        bool isLM,
        uint256 historicalApy,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 variableFactor) {
        uint256 timeInYearsFromStartUntilMaturity = FixedAndVariableMath
            .accrualFact(timeInSecondsFromStartToMaturity);

        if (isFT) {
            if (isLM) {
                variableFactor = PRBMathUD60x18.mul(
                    computeApyBound(
                        termEndTimestampScaled,
                        currentTimestampScaled,
                        historicalApy,
                        true,
                        _marginCalculatorParameters
                    ),
                    timeInYearsFromStartUntilMaturity
                );
            } else {
                variableFactor = PRBMathUD60x18.mul(
                    PRBMathUD60x18.mul(
                        computeApyBound(
                            termEndTimestampScaled,
                            currentTimestampScaled,
                            historicalApy,
                            true,
                            _marginCalculatorParameters
                        ),
                        _marginCalculatorParameters.apyUpperMultiplier
                    ),
                    timeInYearsFromStartUntilMaturity
                );
            }
        } else {
            if (isLM) {
                variableFactor = PRBMathUD60x18.mul(
                    computeApyBound(
                        termEndTimestampScaled,
                        currentTimestampScaled,
                        historicalApy,
                        false,
                        _marginCalculatorParameters
                    ),
                    timeInYearsFromStartUntilMaturity
                );
            } else {
                variableFactor = PRBMathUD60x18.mul(
                    PRBMathUD60x18.mul(
                        computeApyBound(
                            termEndTimestampScaled,
                            currentTimestampScaled,
                            historicalApy,
                            false,
                            _marginCalculatorParameters
                        ),
                        _marginCalculatorParameters.apyLowerMultiplier
                    ),
                    timeInYearsFromStartUntilMaturity
                );
            }
        }
    }

    /// @notice Returns the Minimum Margin Requirement
    /// @dev As a safety measure, Voltz Protocol also computes the minimum margin requirement for FTs and VTs.
    /// @dev This ensures the protocol has a cap on the amount of leverage FTs and VTs can take
    /// @dev Minimum Margin = abs(varaibleTokenBalance) * minDelta * t
    /// @dev minDelta is a parameter that is set separately for FTs and VTs and it is free to vary depending on the underlying rates pool
    /// @dev Also the minDelta is different for Liquidation and Initial Margin Requirements
    /// @dev where minDeltaIM > minDeltaLM
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens
    function getMinimumMarginRequirement(
        TraderMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 margin) {
        MinimumMarginRequirementLocalVars memory vars;

        vars.timeInSeconds =
            params.termEndTimestamp -
            params.termStartTimestamp;

        vars.timeInYears = FixedAndVariableMath.accrualFact(vars.timeInSeconds);

        if (params.isLM) {
            vars.minDelta = uint256(_marginCalculatorParameters.minDeltaLM);
        } else {
            vars.minDelta = uint256(_marginCalculatorParameters.minDeltaIM);
        }

        if (params.variableTokenBalance < 0) {
            // variable token balance must be negative
            vars.notional = uint256(-params.variableTokenBalance);

            margin = PRBMathUD60x18.mul(
                vars.notional,
                PRBMathUD60x18.mul(vars.minDelta, vars.timeInYears)
            );
        } else {
            // variable token balance must be non-negative
            // fixed token balance must be non-positive
            // check that at least one is non-zero

            vars.notional = uint256(params.variableTokenBalance);

            vars.zeroLowerBoundMargin = PRBMathUD60x18.mul(
                uint256(-params.fixedTokenBalance),
                FixedAndVariableMath.fixedFactor(
                    true,
                    params.termStartTimestamp,
                    params.termEndTimestamp
                )
            );

            margin = PRBMathUD60x18.mul(
                vars.notional,
                PRBMathUD60x18.mul(vars.minDelta, vars.timeInYears)
            );

            if (margin > vars.zeroLowerBoundMargin) {
                margin = vars.zeroLowerBoundMargin;
            }
        }
    }

    /// @notice Returns either the Liquidation or Initial Margin Requirement of a given trader
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 margin) {
        if (params.fixedTokenBalance >= 0 && params.variableTokenBalance >= 0) {
            return 0;
        }

        uint256 timeInSecondsFromStartToMaturity = params.termEndTimestamp -
            params.termStartTimestamp;

        int256 exp1 = PRBMathSD59x18.mul(
            params.fixedTokenBalance,
            int256(
                FixedAndVariableMath.fixedFactor(
                    true,
                    params.termStartTimestamp,
                    params.termEndTimestamp
                )
            )
        );

        int256 exp2 = PRBMathSD59x18.mul(
            params.variableTokenBalance,
            int256(
                worstCaseVariableFactorAtMaturity(
                    timeInSecondsFromStartToMaturity,
                    params.termEndTimestamp,
                    Time.blockTimestampScaled(),
                    params.variableTokenBalance < 0,
                    params.isLM,
                    params.historicalApy,
                    _marginCalculatorParameters
                )
            )
        );

        int256 modelMargin = exp1 + exp2;

        int256 minimumMargin = int256(
            getMinimumMarginRequirement(params, _marginCalculatorParameters)
        );
        if (modelMargin < minimumMargin) {
            margin = uint256(minimumMargin);
        } else {
            margin = uint256(modelMargin);
        }
    }

    /// @notice Calculates the margin requirement for an LP whose position is in a tick range that bounds the current tick in the vAMM
    /// @param params Values necessary for the purposes of the computation of the Position Margin Requirement
    /// @dev vars Intermediate Values necessary for the purposes of the computation of the Position Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given position in terms of the underlying tokens
    function positionMarginBetweenTicksHelper(
        PositionMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 margin) {
        PositionMarginRequirementsVars memory vars;

        // going up balance delta --> the trader is giving up variable and is receiving fixed (the trader is a Fixed Taker)
        // causes the prices to go up, implied fixed rates to go down
        // hence amount0Up should be positive and amount1Up should be negative for the trader
        // however, we are interested in the LP's who take the opposite side, so for them
        // amount0Up must be negative and amount1Up should be positive

        require(params.currentTick < params.tickUpper, "currentTick<tickUpper");
        require(
            params.currentTick >= params.tickLower,
            "currentTick >= tickLower"
        );

        // make sure the signs below are correct
        vars.amount0Up = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(params.currentTick),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            -int128(params.liquidity)
        ); // should be negative

        vars.amount1Up = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(params.currentTick),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            int128(params.liquidity)
        ); // should be positive

        assert(vars.amount0Up <= 0);
        assert(vars.amount1Up >= 0);

        vars.expectedVariableTokenBalanceAfterUp =
            params.variableTokenBalance +
            vars.amount1Up;

        vars.expectedFixedTokenBalanceAfterUp =
            params.fixedTokenBalance +
            FixedAndVariableMath.getFixedTokenBalance(
                vars.amount0Up,
                vars.amount1Up,
                params.variableFactor,
                params.termStartTimestamp,
                params.termEndTimestamp
            );

        uint256 marginReqAfterUp = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: vars.expectedFixedTokenBalanceAfterUp,
                variableTokenBalance: vars.expectedVariableTokenBalanceAfterUp,
                termStartTimestamp: params.termStartTimestamp,
                termEndTimestamp: params.termEndTimestamp,
                isLM: params.isLM,
                historicalApy: params.historicalApy
            }),
            _marginCalculatorParameters
        );

        // going down balance delta --> the trader is giving up fixed and is receiving variable (the trader is a Variable Taker)
        // causes the prices to go down, implied fixed rates to go up
        // hence amount0Down must be negative and amount1Up should be positve for the trader
        // however, we are interested in calculating the margin requirement for the LPs who take the opposite side
        // hence, for LPs the amount0Down must be positive and amount1Down should be negative

        vars.amount0Down = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(params.currentTick),
            TickMath.getSqrtRatioAtTick(params.tickLower),
            int128(params.liquidity)
        );

        vars.amount1Down = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(params.currentTick),
            TickMath.getSqrtRatioAtTick(params.tickLower),
            -int128(params.liquidity)
        );

        assert(vars.amount0Down >= 0);
        assert(vars.amount1Down <= 0);

        vars.expectedVariableTokenBalanceAfterDown =
            params.variableTokenBalance +
            vars.amount1Down;

        vars.expectedFixedTokenBalanceAfterDown =
            params.fixedTokenBalance +
            FixedAndVariableMath.getFixedTokenBalance(
                vars.amount0Down,
                vars.amount1Down,
                params.variableFactor,
                params.termStartTimestamp,
                params.termEndTimestamp
            );

        vars.marginReqAfterDown = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: vars.expectedFixedTokenBalanceAfterDown,
                variableTokenBalance: vars
                    .expectedVariableTokenBalanceAfterDown,
                termStartTimestamp: params.termStartTimestamp,
                termEndTimestamp: params.termEndTimestamp,
                isLM: params.isLM,
                historicalApy: params.historicalApy
            }),
            _marginCalculatorParameters
        );

        if (vars.marginReqAfterUp > vars.marginReqAfterDown) {
            margin = marginReqAfterUp;
        } else {
            margin = vars.marginReqAfterDown;
        }
    }

    /// @notice Checks if a given position is liquidatable
    /// @dev In order for a position to be liquidatable its current margin needs to be lower than the position's liquidation margin requirement
    /// @return _isLiquidatable A boolean which suggests if a given position is liquidatable
    function isLiquidatablePosition(
        PositionMarginRequirementParams memory params,
        int256 currentMargin,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (bool _isLiquidatable) {
        uint256 marginRequirement = getPositionMarginRequirement(
            params,
            _marginCalculatorParameters
        );
        if (currentMargin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }
    }


    /// @notice Checks if a given trader is liquidatable
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @param currentMargin Current margin of a trader in terms of the underlying tokens (18 decimals)
    /// @return isLiquidatable A boolean which suggests if a given trader is liquidatable
    function isLiquidatableTrader(
        TraderMarginRequirementParams memory params,
        int256 currentMargin,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (bool isLiquidatable) {
        uint256 marginRequirement = getTraderMarginRequirement(
            params,
            _marginCalculatorParameters
        );

        if (currentMargin < int256(marginRequirement)) {
            isLiquidatable = true;
        } else {
            isLiquidatable = false;
        }
    }

    function getPositionMarginRequirement(
        PositionMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal view returns (uint256 margin) {
        if (params.liquidity == 0) {
            return 0;
        }

        PositionMarginRequirementsVars memory vars;

        // make sure amount values have correct signs

        if (params.currentTick < params.tickLower) {
            if (params.variableTokenBalance > 0) {
                revert("variable balance > 0"); // this should not be possible
            } else if (params.variableTokenBalance < 0) {
                // means the trader deposited on the other side of the tick range
                // the margin just covers the current balances of the position

                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: params.fixedTokenBalance,
                        variableTokenBalance: params.variableTokenBalance,
                        termStartTimestamp: params.termStartTimestamp,
                        termEndTimestamp: params.termEndTimestamp,
                        isLM: params.isLM,
                        historicalApy: params.historicalApy
                    }),
                    _marginCalculatorParameters
                );
            } else {
                // the variable token balance is 0

                vars.amount0 = SqrtPriceMath.getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

                vars.amount1 = SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

                vars.expectedVariableTokenBalance = vars.amount1;
                vars.expectedFixedTokenBalance = FixedAndVariableMath
                    .getFixedTokenBalance(
                        vars.amount0,
                        vars.amount1,
                        params.variableFactor,
                        params.termStartTimestamp,
                        params.termEndTimestamp
                    );

                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp: params.termStartTimestamp,
                        termEndTimestamp: params.termEndTimestamp,
                        isLM: params.isLM,
                        historicalApy: params.historicalApy
                    }),
                    _marginCalculatorParameters
                );
            }
        } else if (params.currentTick < params.tickUpper) {
            margin = positionMarginBetweenTicksHelper(
                params,
                _marginCalculatorParameters
            );
        } else {
            if (params.variableTokenBalance < 0) {
                revert("variable balance < 0"); // this should not be possible
            } else if (params.variableTokenBalance > 0) {
                // means the trader deposited on the other side of the tick range
                // the margin just covers the current balances of the position

                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: params.fixedTokenBalance,
                        variableTokenBalance: params.variableTokenBalance,
                        termStartTimestamp: params.termStartTimestamp,
                        termEndTimestamp: params.termEndTimestamp,
                        isLM: params.isLM,
                        historicalApy: params.historicalApy
                    }),
                    _marginCalculatorParameters
                );
            } else {
                // the variable token balance is 0

                vars.amount0 = SqrtPriceMath.getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

                vars.amount1 = SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

                vars.expectedVariableTokenBalance = vars.amount1;
                vars.expectedFixedTokenBalance = FixedAndVariableMath
                    .getFixedTokenBalance(
                        vars.amount0,
                        vars.amount1,
                        params.variableFactor,
                        params.termStartTimestamp,
                        params.termEndTimestamp
                    );

                margin = getTraderMarginRequirement(
                    TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp: params.termStartTimestamp,
                        termEndTimestamp: params.termEndTimestamp,
                        isLM: params.isLM,
                        historicalApy: params.historicalApy
                    }),
                    _marginCalculatorParameters
                );
            }
        }
    }
}
