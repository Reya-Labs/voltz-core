// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "../interfaces/IMarginCalculator.sol";

contract MarginCalculatorTest is MarginCalculator {
    
    // view function

    function calculateExpectedAmountsTest(uint128 liquidity, int24 currentTick, int24 tickUpper, int24 tickLower) external pure returns (int256 amount1Up, int256 amount0Down) {
        
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
        // bool isLM,
        int24 currentTick,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        uint128 liquidity,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 variableFactor,
        bytes32 rateOracleId,
        uint256 twapApy
    ) external view returns (uint256 margin) {

        return positionMarginBetweenTicksHelper(PositionMarginRequirementParams({
            owner: address(0), // owner should not matter for the purposes of comouting position's margin
            tickLower: tickLower,
            tickUpper: tickUpper,
            isLM: true,
            currentTick: currentTick,
            termStartTimestamp: termStartTimestamp,
            termEndTimestamp: termEndTimestamp,
            liquidity: liquidity,
            fixedTokenBalance: fixedTokenBalance,
            variableTokenBalance: variableTokenBalance,
            variableFactor: variableFactor,
            rateOracleId: rateOracleId,
            twapApy: twapApy
        }));

    }

    function getTraderMarginRequirementTest(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        bool isLM,
        bytes32 rateOracleId,
        uint256 twapApy
    ) external view returns(uint256 margin) {

        return getTraderMarginRequirement(TraderMarginRequirementParams({
            fixedTokenBalance: fixedTokenBalance,
            variableTokenBalance: variableTokenBalance,
            termStartTimestamp: termStartTimestamp,
            termEndTimestamp: termEndTimestamp,
            isLM: isLM,
            rateOracleId: rateOracleId,
            twapApy: twapApy
        }));
        
    }
    
    
    function worstCaseVariableFactorAtMaturityTest(
        uint256 timeInSecondsFromStartToMaturity,
        uint256 timeInSecondsFromNowToMaturity,
        bool isFT,
        bool isLM,
        bytes32 rateOracleId,
        uint256 twapApy
        ) external view returns(uint256 variableFactor) {

            return worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, rateOracleId, twapApy);
    }
    
    function getTimeFactorTest(bytes32 rateOracleId, uint256 timeInDays) external view returns (int256) {

        return timeFactorTimeInDays[rateOracleId][timeInDays];

    }

    function getMarginCalculatorParametersTest(bytes32 rateOracleId) external view returns (
        uint256 apyUpperMultiplier,
        uint256 apyLowerMultiplier,
        uint256 minDeltaLM,
        uint256 minDeltaIM,
        uint256 maxLeverage,
        int256 sigmaSquared,
        int256 alpha,
        int256 beta,
        int256 xiUpper,
        int256 xiLower) {

            MarginCalculatorParameters memory marginCalculatorParameters = getMarginCalculatorParameters[rateOracleId];

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
            uint256 twapApy
        ) external view returns(uint256 margin) {

        return getMinimumMarginRequirement(IMarginCalculator.TraderMarginRequirementParams({
            fixedTokenBalance: fixedTokenBalance,
            variableTokenBalance: variableTokenBalance,
            termStartTimestamp: termStartTimestamp,
            termEndTimestamp: termEndTimestamp,
            isLM: isLM,
            rateOracleId: rateOracleId,
            twapApy: twapApy
        }));

    }


    function computeApyBoundTest(bytes32 rateOracleId, uint256 timeInSeconds, uint256 twapApy, bool isUpper) external view returns (uint256 apyBound) {
        
        return computeApyBound(rateOracleId, timeInSeconds, twapApy, isUpper);
    
    }

    // non_view functions

    function setTimeFactorTest(bytes32 rateOracleId, uint256 timeInDays, int256 timeFactor) external {
        setTimeFactor(rateOracleId, timeInDays, timeFactor);
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
        int256 xiLower
        ) external {

            setMarginCalculatorParameters(MarginCalculatorParameters(
              apyUpperMultiplier,
              apyLowerMultiplier,
              minDeltaLM,
              minDeltaIM,
              maxLeverage,
              sigmaSquared,
              alpha,
              beta,
              xiUpper,
              xiLower
            ),
            rateOracleId);
        }


    // function worstCaseVariableFactorAtMaturityTest(uint256 timeInSecondsFromStartToMaturity, uint256 timeInSecondsFromNowToMaturity, bool isFT, bool isLM, bytes32 rateOracleId, uint256 twapApy) public view returns(uint256 variableFactor) {
    //     return worstCaseVariableFactorAtMaturity(timeInSecondsFromStartToMaturity, timeInSecondsFromNowToMaturity, isFT, isLM, rateOracleId, twapApy);
    // }


    // function getTraderMarginRequirementTest(int256 fixedTokenBalance, 
    //     int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, bool isLM) public view returns(uint256 margin) {

    //     IMarginCalculator.TraderMarginRequirementParams memory params;
    //     params.variableTokenBalance = variableTokenBalance;
    //     params.fixedTokenBalance = fixedTokenBalance;
    //     params.termStartTimestamp = termStartTimestamp;
    //     params.termEndTimestamp = termEndTimestamp;
    //     params.isLM = isLM;

    //     return getTraderMarginRequirement(params);

    // }

}
