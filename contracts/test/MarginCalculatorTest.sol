// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../core_libraries/MarginCalculator.sol";

contract MarginCalculatorTest {
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

    function getTraderMarginRequirement(
        MarginCalculator.TraderMarginRequirementParams memory params,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external view returns (uint256 margin) {
        return
            MarginCalculator.getTraderMarginRequirement(
                params,
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

    function isLiquidatableTrader(
        MarginCalculator.TraderMarginRequirementParams memory params,
        int256 currentMargin,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external view returns (bool isLiquidatable) {
        return
            MarginCalculator.isLiquidatableTrader(
                params,
                currentMargin,
                _marginCalculatorParameters
            );
    }

    function isLiquidatablePosition(
        MarginCalculator.PositionMarginRequirementParams memory params,
        int256 currentMargin,
        IMarginEngine.MarginCalculatorParameters
            memory _marginCalculatorParameters
    ) external view returns (bool _isLiquidatable) {
        return
            MarginCalculator.isLiquidatablePosition(
                params,
                currentMargin,
                _marginCalculatorParameters
            );
    }
}
