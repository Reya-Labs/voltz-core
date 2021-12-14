// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "../interfaces/IMarginCalculator.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";

contract MarginCalculatorTest is MarginCalculator {
    
    // view functions

    // function computeApyBoundTest(bytes32 rateOracleId, uint256 timeInSeconds, uint256 twapApy, bool isUpper) external returns(uint256 apyBound) {

    //     return computeApyBound(rateOracleId, timeInSeconds, twapApy, isUpper);

    // }
    
    function getTimeFactorTest(bytes32 rateOracleId, uint256 timeInDays) external view returns (int256) {

        return timeFactorTimeInDays[rateOracleId][timeInDays].value;

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

            apyUpperMultiplier = marginCalculatorParameters.apyUpperMultiplier.value;
            apyLowerMultiplier = marginCalculatorParameters.apyLowerMultiplier.value;
            minDeltaLM = marginCalculatorParameters.minDeltaLM.value;
            minDeltaIM = marginCalculatorParameters.minDeltaIM.value;
            maxLeverage = marginCalculatorParameters.maxLeverage.value;
            sigmaSquared = marginCalculatorParameters.sigmaSquared.value;
            alpha = marginCalculatorParameters.alpha.value;
            beta = marginCalculatorParameters.beta.value;
            xiUpper = marginCalculatorParameters.xiUpper.value;
            xiLower = marginCalculatorParameters.xiLower.value;

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

            setMarginCalculatorParameters(MarginCalculatorParameters({
                apyUpperMultiplier: PRBMath.UD60x18({
                    value: apyUpperMultiplier
                }),
                apyLowerMultiplier: PRBMath.UD60x18({
                    value: apyLowerMultiplier
                }),
                minDeltaLM:  PRBMath.UD60x18({
                    value: minDeltaLM
                }),
                minDeltaIM:  PRBMath.UD60x18({
                    value: minDeltaIM
                }),
                maxLeverage:  PRBMath.UD60x18({
                    value: maxLeverage
                }),
                sigmaSquared: PRBMath.SD59x18({
                    value: sigmaSquared
                }),
                alpha: PRBMath.SD59x18({
                    value: alpha
                }),
                beta: PRBMath.SD59x18({
                    value: beta
                }),
                xiUpper: PRBMath.SD59x18({
                    value: xiUpper
                }),
                xiLower: PRBMath.SD59x18({
                    value: xiLower
                })
            }),
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
