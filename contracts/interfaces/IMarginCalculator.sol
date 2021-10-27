pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

/// @title The interface for the Voltz AMM Factory
interface IMarginCalculator {

    function apyUpper() external view returns (uint256);
    function apyLower() external view returns (uint256);
    function apyUpperMultiplier() external view returns (uint256);
    function apyLowerMultiplier() external view returns (uint256);
    function minDeltaLM() external view returns (uint256);
    function minDeltaIM() external view returns (uint256);
    function SECONDS_IN_YEAR() external view returns (uint256);
    
    function accrualFact(uint256 timePeriodInSeconds)
            external
            pure
            returns (uint256 timePeriodInYears);
    
    function getLPMarginRequirement(
        uint160 sqrtRatioLower,
        uint160 sqrtRatioUpper,
        uint128 liquidity,
        uint128 grossLiquidity,
        uint160 sqrtRatioCurr,
        uint256 timePeriodInSeconds,
        bool isLM
    ) external view returns (uint256 margin); 


    function getFTMarginRequirement(
        uint256 notional,
        uint256 fixedRate,
        uint256 timePeriodInSeconds,
        bool isLM
    ) external view returns (uint256 margin);

    
    function getVTMarginRequirement(
        uint256 notional,
        uint256 fixedRate,
        uint256 timePeriodInSeconds,
        bool isLM
    ) external view returns (uint256 margin);


}