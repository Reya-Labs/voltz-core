pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

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
        uint256 amount0,
        uint256 amount1,
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


    // function getUnwindSettlementCashflow(
    //     int256 notionalS,
    //     int256 fixedRateS,
    //     int256 notionalU,
    //     int256 fixedRateU,
    //     uint256 timePeriodInSeconds
    // ) external view returns (int256 cashflow);


}