// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

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
import "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title Margin Calculator
/// @notice Margin Calculator Performs the calculations necessary to establish Margin Requirements on Voltz Protocol
library MarginCalculator {
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    using SafeCast for uint256;
    using SafeCast for int256;

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

    /// @dev Seconds in a year
    int256 public constant SECONDS_IN_YEAR = 31536000e18;

    uint256 public constant ONE_UINT = 1e18;
    int256 public constant ONE = 1e18;

    /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t_max) where t is the maturity timestamp, and t_max is the max number of seconds for the IRS AMM duration, s is the current timestamp and beta is a diffusion process parameter set via calibration
    function computeTimeFactor(
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) internal pure returns (int256 timeFactorWad) {
        require(
            currentTimestampWad <= termEndTimestampWad,
            "endTime must be >= currentTime"
        );

        int256 betaWad = _marginCalculatorParameters.betaWad;

        require(betaWad != 0, "parameters not set");

        int256 tMaxWad = _marginCalculatorParameters.tMaxWad;

        int256 scaledTimeWad = (int256(termEndTimestampWad) -
            int256(currentTimestampWad)).div(tMaxWad);

        int256 expInputWad = scaledTimeWad.mul(-betaWad);

        timeFactorWad = expInputWad.exp();
    }

    /// @notice Calculates an APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param termEndTimestampWad termEndTimestampScaled
    /// @param currentTimestampWad currentTimestampScaled
    /// @param historicalApyWad Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
    /// @param isUpper isUpper = true ==> calculating the APY Upper Bound, otherwise APY Lower Bound
    /// @param _marginCalculatorParameters Margin Calculator Parameters (more details in the litepaper) necessary to compute position margin requirements
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

        int256 beta4Wad = _marginCalculatorParameters.betaWad << 2;
        int256 alpha4Wad = _marginCalculatorParameters.alphaWad << 2;

        apyBoundVars.timeFactorWad = computeTimeFactor(
            termEndTimestampWad,
            currentTimestampWad,
            _marginCalculatorParameters
        );

        apyBoundVars.oneMinusTimeFactorWad = ONE - apyBoundVars.timeFactorWad; // ONE is in wei

        apyBoundVars.kWad = alpha4Wad.div(
            _marginCalculatorParameters.sigmaSquaredWad
        );
        apyBoundVars.zetaWad = (
            _marginCalculatorParameters.sigmaSquaredWad.mul(
                apyBoundVars.oneMinusTimeFactorWad
            )
        ).div(beta4Wad);
        apyBoundVars.lambdaNumWad = beta4Wad
            .mul(apyBoundVars.timeFactorWad)
            .mul(int256(historicalApyWad));
        apyBoundVars.lambdaDenWad = _marginCalculatorParameters
            .sigmaSquaredWad
            .mul(apyBoundVars.oneMinusTimeFactorWad);
        apyBoundVars.lambdaWad = apyBoundVars.lambdaNumWad.div(
            apyBoundVars.lambdaDenWad
        );

        apyBoundVars.criticalValueMultiplierWad =
            ((apyBoundVars.lambdaWad << 1) + apyBoundVars.kWad) <<
            1;

        apyBoundVars.criticalValueWad = apyBoundVars
            .criticalValueMultiplierWad
            .sqrt()
            .mul(
                (isUpper)
                    ? _marginCalculatorParameters.xiUpperWad
                    : _marginCalculatorParameters.xiLowerWad
            );

        int256 apyBoundIntWad = apyBoundVars.zetaWad.mul(
            apyBoundVars.kWad +
                apyBoundVars.lambdaWad +
                (
                    isUpper
                        ? apyBoundVars.criticalValueWad
                        : -apyBoundVars.criticalValueWad
                )
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
    /// @param _marginCalculatorParameters Margin Calculator Parameters (more details in the litepaper) necessary to compute position margin requirements
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

        variableFactorWad = computeApyBound(
            termEndTimestampWad,
            currentTimestampWad,
            historicalApyWad,
            isFT,
            _marginCalculatorParameters
        ).mul(timeInYearsFromStartUntilMaturityWad);

        if (!isLM) {
            variableFactorWad = variableFactorWad.mul(
                isFT
                    ? _marginCalculatorParameters.apyUpperMultiplierWad
                    : _marginCalculatorParameters.apyLowerMultiplierWad
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

    /// @notice calculates the absolute fixed token delta unbalanced resulting from a simulated counterfactual unwind necessary to determine the minimum margin requirement of a trader
    /// @dev simulation of a swap without the need to involve the swap function
    /// @param variableTokenDeltaAbsolute absolute value of the variableTokenDelta for which the unwind is simulated
    /// @param sqrtRatioCurrX96 sqrtRatio necessary to calculate the starting fixed rate which is used to calculate the counterfactual unwind fixed rate
    /// @param startingFixedRateMultiplierWad the multiplier (lambda from the litepaper - minimum margin requirement equation) that is multiplied by the starting fixed rate to determine the deviation applied to the starting fixed rate (in Wad)
    /// @param fixedRateDeviationMinWad The minimum value the variable D (from the litepaper) can take
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
    ) internal pure returns (uint256 fixedTokenDeltaUnbalanced) {
        SimulatedUnwindLocalVars memory simulatedUnwindLocalVars;

        // require checks

        // calculate fixedRateStart

        simulatedUnwindLocalVars.sqrtRatioCurrWad = FullMath.mulDiv(
            ONE_UINT,
            sqrtRatioCurrX96,
            FixedPoint96.Q96
        );

        simulatedUnwindLocalVars.fixedRateStartWad = ONE_UINT.div(
            simulatedUnwindLocalVars.sqrtRatioCurrWad.mul(
                simulatedUnwindLocalVars.sqrtRatioCurrWad
            )
        );

        // calculate D (from the litepaper)
        simulatedUnwindLocalVars.upperDWad = simulatedUnwindLocalVars
            .fixedRateStartWad
            .mul(startingFixedRateMultiplierWad);

        if (simulatedUnwindLocalVars.upperDWad < fixedRateDeviationMinWad) {
            simulatedUnwindLocalVars.upperDWad = fixedRateDeviationMinWad;
        }

        // calculate d (from the litepaper)

        simulatedUnwindLocalVars.scaledTimeWad = (termEndTimestampWad -
            currentTimestampWad).div(tMaxWad);

        simulatedUnwindLocalVars.expInputWad = simulatedUnwindLocalVars
            .scaledTimeWad
            .toInt256()
            .mul(-gammaWad.toInt256());
        simulatedUnwindLocalVars.oneMinusTimeFactorWad =
            ONE -
            simulatedUnwindLocalVars.expInputWad.exp();

        /// @audit-casting simulatedUnwindLocalVars.oneMinusTimeFactorWad is expected to be positive here, but what if goes below 0 due to rounding imprecision?
        simulatedUnwindLocalVars.dWad = simulatedUnwindLocalVars.upperDWad.mul(
            simulatedUnwindLocalVars.oneMinusTimeFactorWad.toUint256()
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

        simulatedUnwindLocalVars
            .fixedTokenDeltaUnbalancedWad = variableTokenDeltaAbsolute
            .fromUint()
            .mul(simulatedUnwindLocalVars.fixedRateCFWad);

        // calculate fixedTokenDeltaUnbalanced

        fixedTokenDeltaUnbalanced = simulatedUnwindLocalVars
            .fixedTokenDeltaUnbalancedWad
            .toUint();
    }
}
