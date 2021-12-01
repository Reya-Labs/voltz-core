pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "../interfaces/IMarginCalculator.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

contract MarginCalculatorTest is MarginCalculator {

    function getMinimumMarginRequirementTest(int256 fixedTokenBalance, 
        int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, bool isLM) public view returns(uint256 margin) {

        IMarginCalculator.TraderMarginRequirementParams memory params;
        params.variableTokenBalance = variableTokenBalance;
        params.fixedTokenBalance = fixedTokenBalance;
        params.termStartTimestamp = termStartTimestamp;
        params.termEndTimestamp = termEndTimestamp;
        params.isLM = isLM;

        return getMinimumMarginRequirement(params);

    }


    function worstCaseVariableFactorAtMaturityTest(uint256 timeInSeconds, bool isFT, bool isLM, bytes32 rateOracleId, uint256 twapApy) public view returns(uint256 variableFactor) {
        return worstCaseVariableFactorAtMaturity(timeInSeconds, isFT, isLM, rateOracleId, twapApy);
    }


    function getTraderMarginRequirementTest(int256 fixedTokenBalance, 
        int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, bool isLM) public view returns(uint256 margin) {

        IMarginCalculator.TraderMarginRequirementParams memory params;
        params.variableTokenBalance = variableTokenBalance;
        params.fixedTokenBalance = fixedTokenBalance;
        params.termStartTimestamp = termStartTimestamp;
        params.termEndTimestamp = termEndTimestamp;
        params.isLM = isLM;

        return getTraderMarginRequirement(params);

    }


}
