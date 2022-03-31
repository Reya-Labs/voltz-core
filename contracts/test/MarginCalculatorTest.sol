// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../core_libraries/MarginCalculator.sol";
import "../core_libraries/FixedAndVariableMath.sol";

contract MarginCalculatorTest {
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
    ) external pure returns (uint256 fixedTokenDeltaUnbalanced) {
        return
            MarginCalculator
                .getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
                    variableTokenDeltaAbsolute,
                    sqrtRatioCurrX96,
                    startingFixedRateMultiplierWad,
                    fixedRateDeviationMinWad,
                    termEndTimestampWad,
                    currentTimestampWad,
                    tMaxWad,
                    gammaWad,
                    isFTUnwind
                );
    }

    function computeTimeFactor(
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external pure returns (int256 timeFactor) {
        return
            MarginCalculator.computeTimeFactor(
                termEndTimestampWad,
                currentTimestampWad,
                _marginCalculatorParameters
            );
    }

    function computeApyBound(
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        uint256 historicalApyWad,
        bool isUpper,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external pure returns (uint256 apyBoundWad) {
        return
            MarginCalculator.computeApyBound(
                termEndTimestampWad,
                currentTimestampWad,
                historicalApyWad,
                isUpper,
                _marginCalculatorParameters
            );
    }

    function worstCaseVariableFactorAtMaturity(
        uint256 timeInSecondsFromStartToMaturityWad,
        uint256 termEndTimestampWad,
        uint256 currentTimestampWad,
        bool isFT,
        bool isLM,
        uint256 historicalApyWad,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external pure returns (uint256 variableFactorWad) {
        return
            MarginCalculator.worstCaseVariableFactorAtMaturity(
                timeInSecondsFromStartToMaturityWad,
                termEndTimestampWad,
                currentTimestampWad,
                isFT,
                isLM,
                historicalApyWad,
                _marginCalculatorParameters
            );
    }

    function getFixedTokenBalanceFromMCTest(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) external view returns (int256 fixedTokenBalance) {
        return
            FixedAndVariableMath.getFixedTokenBalance(
                amount0,
                amount1,
                accruedVariableFactor,
                termStartTimestamp,
                termEndTimestamp
            );
    }
}
