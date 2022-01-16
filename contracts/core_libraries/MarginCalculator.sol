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
        /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t_max) where t is the maturity timestamp, s is the current timestamp and beta is a diffusion process parameter set via calibration, t_max is the max possible duration of an IRS AMM
        int256 timeFactorWad;
        /// @dev 1 - timeFactor
        int256 oneMinusTimeFactorWad;
        /// @dev k = (4 * alpha/sigmaSquared)
        int256 kWad;
        /// @dev zeta = (sigmaSquared*(1-timeFactor))/ 4 * beta
        int256 zetaWad;
        /// @dev lambdaNum = 4 * beta * timeFactor * historicalApy
        int256 lambdaNumWad;
        /// @dev lambdaDen = sigmaSquared * (1 - timeFactor)
        int256 lambdaDenWad;
        /// @dev lambda = lambdaNum / lambdaDen
        int256 lambdaWad;
        /// @dev critical value = 2(k+2lambda)
        int256 criticalValueMultiplierWad;
        /// @dev critical value = sqrt(2(k+2*lambda))*xiUpper (for upper bound calculation), critical value = sqrt(2(k+2*lambda))*xiLower (for lower bound calculation)
        int256 criticalValueWad;
    }

    struct TraderMarginRequirementParams {
        /// @dev current fixedToken balance of a given trader
        int256 fixedTokenBalance;
        /// @dev current variableToken balance of a given trader
        int256 variableTokenBalance;
        /// @dev timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestampWad;
        /// @dev timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestampWad;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev Historical Average APY of the underlying pool (e.g. Aave v2 USDC Lending Pool), 18 decimals
        uint256 historicalApyWad;
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
        uint256 termStartTimestampWad;
        /// @dev Timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestampWad;
        /// @dev Amount of active liquidity of a position
        uint128 liquidity;
        /// @dev Curren Fixed Token Balance of a position
        /// @dev In order for this value to be up to date, the Position needs to first check what the fixedTokenGrowthInside is within their tick range and then calculate accrued fixed token delta since the last check
        int256 fixedTokenBalance;
        /// @dev Curren Variabe Token Balance of a position
        /// @dev In order for this value to be up to date, the Position needs to first check what the variableTokenGrowthInside is within their tick range and then calculate accrued variable token delta since the last check
        int256 variableTokenBalance;
        /// @dev Variable Factor is the variable rate from the IRS AMM initiation until the current block timestamp
        uint256 variableFactorWad;
        /// @dev Historical Average APY of the underlying pool (e.g. Aave v2 USDC Lending Pool), 18 decimals
        uint256 historicalApyWad;
    }

    struct MinimumMarginRequirementLocalVars {
        /// @dev Minimum possible absolute APY delta between the underlying pool and the fixed rate of a given IRS contract, used as a safety measure (18 decimals)
        /// @dev minDelta is different depending on whether we are calculating a Liquidation or an Initial Margin Requirement
        uint256 minDeltaWad;
        /// @dev notional is the absolute value of the variable token balance (18 decimals)
        uint256 notionalWad;
        /// @dev timeInSeconds = termEndTimestamp - termStartTimestamp of the IRS AMM (18 decimals)
        uint256 timeInSecondsWad;
        /// @dev timeInYears = timeInSeconds / SECONDS_IN_YEAR (where SECONDS_IN_YEAR=31536000) (18 decimals)
        uint256 timeInYearsWad;
        /// @dev Only relevant for Variable Takers, since the worst case scenario for them if the variable rates are at the zero lower bound, assuming the APY in the underlying yield-bearing pool can never be negative
        /// @dev zeroLowerBoundMargin = abs(fixedTokenBalance) * timeInYears * 1%
        uint256 zeroLowerBoundMarginWad;
    }

    /// suggestions: do the below conversions using PRBMath
    int256 public constant ONE_WEI = 10**18;

    /// @dev Seconds in a year
    int256 public constant SECONDS_IN_YEAR = 31536000 * ONE_WEI;

    /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t_max) where t is the maturity timestamp, and t_max is the max number of seconds for the IRS AMM duration, s is the current timestamp and beta is a diffusion process parameter set via calibration
    function computeTimeFactor(
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal pure returns (int256 timeFactorWad) {
        require(termEndTimestampWad > 0, "termEndTimestamp must be > 0");
        require(
            currentTimestampWad <= termEndTimestampWad,
            "endTime must be > currentTime"
        );
        require(_marginCalculatorParameters.betaWad != 0, "parameters not set");

        int256 betaWad = _marginCalculatorParameters.betaWad;
        int256 tMaxWad = _marginCalculatorParameters.tMaxWad;

        int256 scaledTimeWad = PRBMathSD59x18.div(
            (int256(termEndTimestampWad) - int256(currentTimestampWad)),
            tMaxWad
        );

        int256 expInputWad = PRBMathSD59x18.mul((-betaWad), scaledTimeWad);

        timeFactorWad = PRBMathSD59x18.exp(expInputWad);
    }

    /// @notice Calculates an APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param termEndTimestampWad termEndTimestampScaled
    /// @param currentTimestampWad currentTimestampScaled
    /// @param historicalApyWad Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param isUpper isUpper = true ==> calculating the APY Upper Bound, otherwise APY Lower Bound
    /// @return apyBoundWad APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    function computeApyBound(
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        uint256 historicalApyWad,
        bool isUpper,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal pure returns (uint256 apyBoundWad) {
        ApyBoundVars memory apyBoundVars;

        int256 beta4Wad = PRBMathSD59x18.mul(
            _marginCalculatorParameters.betaWad,
            PRBMathSD59x18.fromInt(4)
        );

        int256 alpha4Wad = PRBMathSD59x18.mul(
            _marginCalculatorParameters.alphaWad,
            PRBMathSD59x18.fromInt(4)
        );

        apyBoundVars.timeFactorWad = computeTimeFactor(
            termEndTimestampWad,
            currentTimestampWad,
            _marginCalculatorParameters
        );

        apyBoundVars.oneMinusTimeFactorWad =
            PRBMathSD59x18.fromInt(1) -
            apyBoundVars.timeFactorWad;

        apyBoundVars.kWad = PRBMathSD59x18.div(
            alpha4Wad,
            _marginCalculatorParameters.sigmaSquaredWad
        );

        apyBoundVars.zetaWad = PRBMathSD59x18.div(
            PRBMathSD59x18.mul(
                _marginCalculatorParameters.sigmaSquaredWad,
                apyBoundVars.oneMinusTimeFactorWad
            ),
            beta4Wad
        );

        apyBoundVars.lambdaNumWad = PRBMathSD59x18.mul(
            PRBMathSD59x18.mul(beta4Wad, apyBoundVars.timeFactorWad),
            int256(historicalApyWad)
        );

        apyBoundVars.lambdaDenWad = PRBMathSD59x18.mul(
            _marginCalculatorParameters.sigmaSquaredWad,
            apyBoundVars.oneMinusTimeFactorWad
        );

        apyBoundVars.lambdaWad = PRBMathSD59x18.div(
            apyBoundVars.lambdaNumWad,
            apyBoundVars.lambdaDenWad
        );

        apyBoundVars.criticalValueMultiplierWad = PRBMathSD59x18.mul(
            (PRBMathSD59x18.mul(
                PRBMathSD59x18.fromInt(2),
                apyBoundVars.lambdaWad
            ) + apyBoundVars.kWad),
            (PRBMathSD59x18.fromInt(2))
        );

        if (isUpper) {
            apyBoundVars.criticalValueWad = PRBMathSD59x18.mul(
                _marginCalculatorParameters.xiUpperWad,
                PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplierWad)
            );
        } else {
            apyBoundVars.criticalValueWad = PRBMathSD59x18.mul(
                _marginCalculatorParameters.xiLowerWad,
                PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplierWad)
            );
        }

        int256 apyBoundIntWad = PRBMathSD59x18.mul(
            apyBoundVars.zetaWad,
            (apyBoundVars.kWad +
                apyBoundVars.lambdaWad +
                apyBoundVars.criticalValueWad)
        );

        if (apyBoundIntWad < 0) {
            apyBoundWad = 0;
        } else {
            apyBoundWad = uint256(apyBoundIntWad);
        }
    }

    /// @notice Calculates the Worst Case Variable Factor At Maturity
    /// @param timeInSecondsFromStartToMaturityWad Duration of a given IRS AMM (18 decimals)
    /// @param termEndTimestampWad termEndTimestampWad
    /// @param currentTimestampWad currentTimestampWad
    /// @param isFT isFT => we are dealing with a Fixed Taker (short) IRS position, otherwise it is a Variable Taker (long) IRS position
    /// @param isLM isLM => we are computing a Liquidation Margin otherwise computing an Initial Margin
    /// @param historicalApyWad Historical Average APY of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @return variableFactorWad The Worst Case Variable Factor At Maturity = APY Bound * accrualFactor(timeInYearsFromStartUntilMaturity) where APY Bound = APY Upper Bound for Fixed Takers and APY Lower Bound for Variable Takers (18 decimals)
    function worstCaseVariableFactorAtMaturity(
        uint256 timeInSecondsFromStartToMaturityWad,
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        bool isFT,
        bool isLM,
        uint256 historicalApyWad,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal pure returns (uint256 variableFactorWad) {
        uint256 timeInYearsFromStartUntilMaturityWad = FixedAndVariableMath
            .accrualFact(timeInSecondsFromStartToMaturityWad);

        if (isFT) {
            if (isLM) {
                variableFactorWad = PRBMathUD60x18.mul(
                    computeApyBound(
                        termEndTimestampWad,
                        currentTimestampWad,
                        historicalApyWad,
                        true,
                        _marginCalculatorParameters
                    ),
                    timeInYearsFromStartUntilMaturityWad
                );
            } else {
                variableFactorWad = PRBMathUD60x18.mul(
                    PRBMathUD60x18.mul(
                        computeApyBound(
                            termEndTimestampWad,
                            currentTimestampWad,
                            historicalApyWad,
                            true,
                            _marginCalculatorParameters
                        ),
                        _marginCalculatorParameters.apyUpperMultiplierWad
                    ),
                    timeInYearsFromStartUntilMaturityWad
                );
            }
        } else {
            if (isLM) {
                variableFactorWad = PRBMathUD60x18.mul(
                    computeApyBound(
                        termEndTimestampWad,
                        currentTimestampWad,
                        historicalApyWad,
                        false,
                        _marginCalculatorParameters
                    ),
                    timeInYearsFromStartUntilMaturityWad
                );
            } else {
                variableFactorWad = PRBMathUD60x18.mul(
                    PRBMathUD60x18.mul(
                        computeApyBound(
                            termEndTimestampWad,
                            currentTimestampWad,
                            historicalApyWad,
                            false,
                            _marginCalculatorParameters
                        ),
                        _marginCalculatorParameters.apyLowerMultiplierWad
                    ),
                    timeInYearsFromStartUntilMaturityWad
                );
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
        require(
            params.termEndTimestampWad > params.termStartTimestampWad,
            "TE>TS"
        );

        if (params.fixedTokenBalance >= 0 && params.variableTokenBalance >= 0) {
            return 0;
        }

        int256 fixedTokenBalanceWad = PRBMathSD59x18.fromInt(
            params.fixedTokenBalance
        );
        int256 variableTokenBalanceWad = PRBMathSD59x18.fromInt(
            params.variableTokenBalance
        );

        uint256 timeInSecondsFromStartToMaturityWad = params
            .termEndTimestampWad - params.termStartTimestampWad;

        int256 exp1Wad = PRBMathSD59x18.mul(
            fixedTokenBalanceWad,
            int256(
                FixedAndVariableMath.fixedFactor(
                    true,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                )
            )
        );

        int256 exp2Wad = PRBMathSD59x18.mul(
            variableTokenBalanceWad,
            int256(
                worstCaseVariableFactorAtMaturity(
                    timeInSecondsFromStartToMaturityWad,
                    params.termEndTimestampWad,
                    Time.blockTimestampScaled(),
                    params.variableTokenBalance < 0,
                    params.isLM,
                    params.historicalApyWad,
                    _marginCalculatorParameters
                )
            )
        );

        int256 modelMarginWad = exp1Wad + exp2Wad;

        /// @audit rethink if minimum margin requirement is necessary given we have flexibility with MC parameters

        if (modelMarginWad < 0) {
            margin = 0;
        } else {
            margin = PRBMathUD60x18.toUint(uint256(modelMarginWad));
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
        // @audit Check if this logic is the best way to handle position margin requirement calculation, check calc with pen and paper again

        int256 scenario1LPVariableTokenBalance;
        int256 scenario1LPFixedTokenBalance;

        int256 scenario2LPVariableTokenBalance;
        int256 scenario2LPFixedTokenBalance;

        if (params.currentTick < params.tickLower) {
            /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickUpper given current liqudity of the LP
            /// @dev scenario 2: current tick never reaches the tickLower (LP stays with their current fixed and variable token balances)

            /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
            /// @dev Scenario 1

            /// @dev this value is negative since the LP is a Variable Taker in this case
            int256 amount0FromTickLowerToTickUpper = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

            /// @dev this value is positive since the LP is a Variable Taker in this case
            int256 amount1FromTickLowerToTickUpper = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

            /// @audit should not use PRB math for the below calculation

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromTickLowerToTickUpper;

            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromTickLowerToTickUpper,
                    amount1FromTickLowerToTickUpper,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev Scenario 2
            scenario2LPVariableTokenBalance = params.variableTokenBalance;
            scenario2LPFixedTokenBalance = params.fixedTokenBalance;
        } else if (params.currentTick < params.tickUpper) {
            /// @dev scenario 1: a trader comes in and trades all the liquidity from currentTick to tickUpper given current liquidity of LP
            /// @dev scenario 2: a trader comes in and trades all the liquidity from currentTick to tickLower given current liquidity of LP

            /// @dev from the perspective of the LP (not the trader who is a Fixed Taker)
            /// @dev Scenario 1

            /// @dev this value is negative since the LP is a Variable Taker in this case
            int256 amount0FromCurrentTickToTickUpper = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    -int128(params.liquidity)
                );

            /// @dev this value is positive since the LP is a Variable Taker in this case
            int256 amount1FromCurrentTickToTickUpper = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(params.liquidity)
                );

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromCurrentTickToTickUpper;
            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromCurrentTickToTickUpper,
                    amount1FromCurrentTickToTickUpper,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
            /// @dev Scenario 2

            /// @dev this value is positive since the LP is a Fixed Taker in this case
            int256 amount0FromCurrentTickToTickLower = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    int128(params.liquidity)
                );

            /// @dev this value is negative since the LP is a FixedTaker in this case
            int256 amount1FromCurrentTickToTickLower = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.currentTick),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    -int128(params.liquidity)
                );

            scenario2LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromCurrentTickToTickLower;
            scenario2LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromCurrentTickToTickLower,
                    amount1FromCurrentTickToTickLower,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );
        } else {
            /// @dev scenario 1: a trader comes in and trades all the liqudiity all the way to tickLower given current liqudity of the LP
            /// @dev scenario 2: current tick never reaches the tickUpper (LP stays with their current fixed and variable token balances)

            /// @dev from the perspective of the LP (not the trader who is a Variable Taker)
            /// @dev Scenario 1

            /// @dev this value is positive since the LP is a Fixed Taker in this case
            int256 amount0FromTickUpperToTickLower = SqrtPriceMath
                .getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    int128(params.liquidity)
                );

            /// @dev this value is negative since the LP is a Fixed Taker in this case
            int256 amount1FromTickUpperToTickLower = SqrtPriceMath
                .getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    -int128(params.liquidity)
                );

            scenario1LPVariableTokenBalance =
                params.variableTokenBalance +
                amount1FromTickUpperToTickLower;
            scenario1LPFixedTokenBalance =
                params.fixedTokenBalance +
                FixedAndVariableMath.getFixedTokenBalance(
                    amount0FromTickUpperToTickLower,
                    amount1FromTickUpperToTickLower,
                    params.variableFactorWad,
                    params.termStartTimestampWad,
                    params.termEndTimestampWad
                );

            /// @dev Scenario 2
            scenario2LPVariableTokenBalance = params.variableTokenBalance;
            scenario2LPFixedTokenBalance = params.fixedTokenBalance;
        }

        uint256 scenario1MarginRequirement = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: scenario1LPFixedTokenBalance,
                variableTokenBalance: scenario1LPVariableTokenBalance,
                termStartTimestampWad: params.termStartTimestampWad,
                termEndTimestampWad: params.termEndTimestampWad,
                isLM: params.isLM,
                historicalApyWad: params.historicalApyWad
            }),
            _marginCalculatorParameters
        );

        uint256 scenario2MarginRequirement = getTraderMarginRequirement(
            TraderMarginRequirementParams({
                fixedTokenBalance: scenario2LPFixedTokenBalance,
                variableTokenBalance: scenario2LPVariableTokenBalance,
                termStartTimestampWad: params.termStartTimestampWad,
                termEndTimestampWad: params.termEndTimestampWad,
                isLM: params.isLM,
                historicalApyWad: params.historicalApyWad
            }),
            _marginCalculatorParameters
        );

        if (scenario1MarginRequirement > scenario2MarginRequirement) {
            return scenario1MarginRequirement;
        } else {
            return scenario2MarginRequirement;
        }
    }
}
