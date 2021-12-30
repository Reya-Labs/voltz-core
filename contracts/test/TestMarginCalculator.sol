// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "../interfaces/IMarginCalculator.sol";

contract TestMarginCalculator is MarginCalculator {
    // solhint-disable-next-line no-empty-blocks
    constructor(address _factory) MarginCalculator(_factory) {}

    // view functions

    function computeTimeFactorTest(
        bytes32 rateOracleId,
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled
    ) external view returns (int256 timeFactor) {
        return
            computeTimeFactor(
                rateOracleId,
                termEndTimestampScaled,
                currentTimestampScaled
            );
    }

    function calculateExpectedAmountsTest(
        uint128 liquidity,
        int24 currentTick,
        int24 tickUpper,
        int24 tickLower
    ) external pure returns (int256 amount1Up, int256 amount0Down) {
        // go through this again [ask Moody for elaboration]

        // want this to be negative

        amount1Up = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(currentTick),
            TickMath.getSqrtRatioAtTick(tickUpper),
            -int128(liquidity)
        );

        // want this to be negative

        amount0Down = SqrtPriceMath.getAmount0Delta(
            TickMath.getSqrtRatioAtTick(currentTick),
            TickMath.getSqrtRatioAtTick(tickLower),
            -int128(liquidity)
        );
    }

    function positionMarginBetweenTicksHelperLMTest(
        int24 tickLower,
        int24 tickUpper,
        bool isLM,
        int24 currentTick,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        uint128 liquidity,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 variableFactor,
        bytes32 rateOracleId,
        uint256 historicalApy
    ) external view returns (uint256 margin) {
        return
            positionMarginBetweenTicksHelper(
                PositionMarginRequirementParams({
                    owner: address(0), // owner should not matter for the purposes of computing position's margin
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    isLM: isLM,
                    currentTick: currentTick,
                    termStartTimestamp: termStartTimestamp,
                    termEndTimestamp: termEndTimestamp,
                    liquidity: liquidity,
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    variableFactor: variableFactor,
                    rateOracleId: rateOracleId,
                    historicalApy: historicalApy
                })
            );
    }

    function getTraderMarginRequirementTest(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        bool isLM,
        bytes32 rateOracleId,
        uint256 historicalApy
    ) external view returns (uint256 margin) {
        return
            getTraderMarginRequirement(
                TraderMarginRequirementParams({
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    termStartTimestamp: termStartTimestamp,
                    termEndTimestamp: termEndTimestamp,
                    isLM: isLM,
                    rateOracleId: rateOracleId,
                    historicalApy: historicalApy
                })
            );
    }

    function worstCaseVariableFactorAtMaturityTest(
        uint256 timeInSecondsFromStartToMaturity,
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled,
        bool isFT,
        bool isLM,
        bytes32 rateOracleId,
        uint256 historicalApy
    ) external view returns (uint256 variableFactor) {
        return
            worstCaseVariableFactorAtMaturity(
                timeInSecondsFromStartToMaturity,
                termEndTimestampScaled,
                currentTimestampScaled,
                isFT,
                isLM,
                rateOracleId,
                historicalApy
            );
    }

    function getMarginCalculatorParametersTest(bytes32 rateOracleId)
        external
        view
        returns (
            uint256 apyUpperMultiplier,
            uint256 apyLowerMultiplier,
            uint256 minDeltaLM,
            uint256 minDeltaIM,
            uint256 maxLeverage,
            int256 sigmaSquared,
            int256 alpha,
            int256 beta,
            int256 xiUpper,
            int256 xiLower
        )
    {
        MarginCalculatorParameters
            memory marginCalculatorParameters = getMarginCalculatorParameters[
                rateOracleId
            ];

        apyUpperMultiplier = marginCalculatorParameters.apyUpperMultiplier;
        apyLowerMultiplier = marginCalculatorParameters.apyLowerMultiplier;
        minDeltaLM = marginCalculatorParameters.minDeltaLM;
        minDeltaIM = marginCalculatorParameters.minDeltaIM;
        maxLeverage = marginCalculatorParameters.maxLeverage;
        sigmaSquared = marginCalculatorParameters.sigmaSquared;
        alpha = marginCalculatorParameters.alpha;
        beta = marginCalculatorParameters.beta;
        xiUpper = marginCalculatorParameters.xiUpper;
        xiLower = marginCalculatorParameters.xiLower;
    }

    function getMinimumMarginRequirementTest(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        bool isLM,
        bytes32 rateOracleId,
        uint256 historicalApy
    ) external view returns (uint256 margin) {
        return
            getMinimumMarginRequirement(
                IMarginCalculator.TraderMarginRequirementParams({
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    termStartTimestamp: termStartTimestamp,
                    termEndTimestamp: termEndTimestamp,
                    isLM: isLM,
                    rateOracleId: rateOracleId,
                    historicalApy: historicalApy
                })
            );
    }

    function computeApyBoundTest(
        bytes32 rateOracleId,
        uint256 termEndTimestampScaled,
        uint256 currentTimestampScaled,
        uint256 historicalApy,
        bool isUpper
    ) external view returns (uint256 apyBound) {
        return
            computeApyBound(
                rateOracleId,
                termEndTimestampScaled,
                currentTimestampScaled,
                historicalApy,
                isUpper
            );
    }

    function setMarginCalculatorParametersTest(
        bytes32 rateOracleId,
        uint256 apyUpperMultiplier,
        uint256 apyLowerMultiplier,
        uint256 minDeltaLM,
        uint256 minDeltaIM,
        uint256 maxLeverage,
        int256 sigmaSquared,
        int256 alpha,
        int256 beta,
        int256 xiUpper,
        int256 xiLower,
        int256 tMax
    ) external {
        setMarginCalculatorParameters(
            MarginCalculatorParameters(
                apyUpperMultiplier,
                apyLowerMultiplier,
                minDeltaLM,
                minDeltaIM,
                maxLeverage,
                sigmaSquared,
                alpha,
                beta,
                xiUpper,
                xiLower,
                tMax
            ),
            rateOracleId
        );
    }


}
