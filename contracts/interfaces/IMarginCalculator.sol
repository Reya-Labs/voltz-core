pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

interface IMarginCalculator {

    struct LPMarginParams {

        uint160 ratioLower;
        uint160 ratioUpper;
        uint256 amount0;
        uint256 amount1;
        uint160 ratioCurr;
        uint256 timePeriodInSeconds;
        bool isLM;
        int256 accruedVariableFactor;
        uint256 termStartTimestamp;
        uint256 termEndTimestamp;

    }
    
    function apyUpper() external view returns (uint256);
    function apyLower() external view returns (uint256);
    function apyUpperMultiplier() external view returns (uint256);
    function apyLowerMultiplier() external view returns (uint256);
    function minDeltaLM() external view returns (uint256);
    function minDeltaIM() external view returns (uint256);
    function SECONDS_IN_YEAR() external view returns (uint256);
    function maxLeverage() external view returns (uint256);
    
    function getTraderMarginRequirement(
        int256 fixedTokenBalance,
        int256 variableTokenBalance, 
        int256 fixedFactorAtMaturity,
        uint256 fixedFactorFromNowToMaturity,
        uint256 timePeriodInSeconds,
        bool isLM
    ) external returns(uint256 margin);


    function getLPMarginRequirement(
        LPMarginParams memory params
    ) external returns(uint256 margin);


}