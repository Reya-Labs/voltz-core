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
import "../utils/FullMath.sol";
import "../utils/FixedPoint96.sol";

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
        /// @dev critical value multiplier = 2(k+2lambda)
        int256 criticalValueMultiplierWad;
        /// @dev critical value = sqrt(2(k+2*lambda))*xiUpper (for upper bound calculation), critical value = sqrt(2(k+2*lambda))*xiLower (for lower bound calculation)
        int256 criticalValueWad;
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

        int256 apyBoundIntWad = (isUpper)
            ? PRBMathSD59x18.mul(
                apyBoundVars.zetaWad,
                (apyBoundVars.kWad +
                    apyBoundVars.lambdaWad +
                    apyBoundVars.criticalValueWad)
            )
            : PRBMathSD59x18.mul(
                apyBoundVars.zetaWad,
                (apyBoundVars.kWad +
                    apyBoundVars.lambdaWad -
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

        if (isLM) {
            variableFactorWad = PRBMathUD60x18.mul(
                computeApyBound(
                    termEndTimestampWad,
                    currentTimestampWad,
                    historicalApyWad,
                    isFT,
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
                        isFT,
                        _marginCalculatorParameters
                    ),
                    isFT ? _marginCalculatorParameters.apyUpperMultiplierWad : _marginCalculatorParameters.apyLowerMultiplierWad
                ),
                timeInYearsFromStartUntilMaturityWad
            );
        }
    }

    struct SimulatedUnwindLocalVars {
        uint256 sqrtRatioCurrWad;
        uint256 fixedRateStartWad;
        uint256 upperDWad;
        uint256 scaledTimeWad;
        int256 expInputWad;
        int256 oneMinusTimeFactorWad;
        uint256 dWad;
        uint256 fixedRateCFWad;
        uint256 fixedTokenDeltaUnbalancedWad;
    }

    // simulation of a swap without the need to involve the swap function
    /// @notice calculates the absolute fixed token delta unbalanced resulting from a simulated counterfactual unwind necessary to determine the minimum margin requirement of a trader
    /// @param variableTokenDeltaAbsolute absolute value of the variableTokenDelta for which the unwind is simulated
    /// @param sqrtRatioCurrX96 sqrtRatio necessary to calculate the starting fixed rate which is used to calculate the counterfactual unwind fixed rate
    /// @param startingFixedRateMultiplierWad the multiplier (lambda from the litepaper - minimum margin requirement equation) that is multiplied by the starting fixed rate to determine the deviation applied to the starting fixed rate (in Wad)
    /// @param termEndTimestampWad term end timestamp in wad
    /// @param currentTimestampWad current timestamp in wad
    /// @param tMaxWad the maximum duration for a Voltz Protocol IRS AMM
    /// @param gammaWad adjustable parameter that controls the rate of time decay applied to the deviation depending on time from now to maturity
    /// @param isFTUnwind isFTUnwind == true => the counterfactual unwind is in the Fixed Taker direction (from left to right along the VAMM), the opposite is true if isFTUnwind == false
    function getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
        uint256 variableTokenDeltaAbsolute,
        uint160 sqrtRatioCurrX96,
        uint256 startingFixedRateMultiplierWad,
        uint256 fixedRateDeviationMinWad,
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        uint256 tMaxWad,
        uint256 gammaWad,
        bool isFTUnwind
    ) internal view returns (uint256 fixedTokenDeltaUnbalanced) {
        SimulatedUnwindLocalVars memory simulatedUnwindLocalVars;

        // require checks

        // calculate fixedRateStart
        simulatedUnwindLocalVars.sqrtRatioCurrWad = FullMath.mulDiv(
            PRBMathUD60x18.fromUint(1),
            sqrtRatioCurrX96,
            FixedPoint96.Q96
        );

        simulatedUnwindLocalVars.fixedRateStartWad = PRBMathUD60x18.div(
            PRBMathUD60x18.fromUint(1),
            PRBMathUD60x18.mul(
                simulatedUnwindLocalVars.sqrtRatioCurrWad,
                simulatedUnwindLocalVars.sqrtRatioCurrWad
            )
        );

        // calculate D (from the litepaper)
        simulatedUnwindLocalVars.upperDWad = PRBMathUD60x18.mul(
            simulatedUnwindLocalVars.fixedRateStartWad,
            startingFixedRateMultiplierWad
        );

        if (simulatedUnwindLocalVars.upperDWad < fixedRateDeviationMinWad) {
            simulatedUnwindLocalVars.upperDWad = fixedRateDeviationMinWad;
        }

        // calculate d (from the litepaper)

        simulatedUnwindLocalVars.scaledTimeWad = PRBMathUD60x18.div(
            (termEndTimestampWad - currentTimestampWad),
            tMaxWad
        );

        simulatedUnwindLocalVars.expInputWad = PRBMathSD59x18.mul(
            (-int256(gammaWad)),
            int256(simulatedUnwindLocalVars.scaledTimeWad)
        );

        simulatedUnwindLocalVars.oneMinusTimeFactorWad =
            PRBMathSD59x18.fromInt(1) -
            PRBMathSD59x18.exp(simulatedUnwindLocalVars.expInputWad);

        /// @audit-casting simulatedUnwindLocalVars.oneMinusTimeFactorWad is expected to be positive here, but what if goes below 0 due to rounding imprecision?
        simulatedUnwindLocalVars.dWad = PRBMathUD60x18.mul(
            simulatedUnwindLocalVars.upperDWad,
            uint256(simulatedUnwindLocalVars.oneMinusTimeFactorWad)
        );

        // calculate counterfactual fixed rate

        if (isFTUnwind) {
            if (
                simulatedUnwindLocalVars.fixedRateStartWad >
                simulatedUnwindLocalVars.dWad
            ) {
                simulatedUnwindLocalVars.fixedRateCFWad =
                    simulatedUnwindLocalVars.fixedRateStartWad -
                    simulatedUnwindLocalVars.dWad;
            } else {
                simulatedUnwindLocalVars.fixedRateCFWad = 0;
            }
        } else {
            simulatedUnwindLocalVars.fixedRateCFWad =
                simulatedUnwindLocalVars.fixedRateStartWad +
                simulatedUnwindLocalVars.dWad;
        }

        // calculate fixedTokenDeltaUnbalancedWad

        simulatedUnwindLocalVars.fixedTokenDeltaUnbalancedWad = PRBMathUD60x18
            .mul(
                PRBMathUD60x18.fromUint(variableTokenDeltaAbsolute),
                simulatedUnwindLocalVars.fixedRateCFWad
            );

        // calculate fixedTokenDeltaUnbalanced

        fixedTokenDeltaUnbalanced = PRBMathUD60x18.toUint(
            simulatedUnwindLocalVars.fixedTokenDeltaUnbalancedWad
        );
    }
}
