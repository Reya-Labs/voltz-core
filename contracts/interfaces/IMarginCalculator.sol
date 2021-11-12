pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";

interface IMarginCalculator {
    struct LPMarginParams {
        uint160 sqrtRatioLower;
        uint160 sqrtRatioUpper;
        bool isLM;
        uint128 liquidity;
        uint256 termStartTimestamp;
        uint256 termEndTimestamp;
    }

    struct TraderMarginRequirementParams {
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        uint256 termStartTimestamp;
        uint256 termEndTimestamp;
        bool isLM;
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
        TraderMarginRequirementParams memory params
    ) external view returns (uint256 margin);
}
