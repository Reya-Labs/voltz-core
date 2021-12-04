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

        bytes32 rateOracleId;
        uint256 twapApy;
    }

    struct PositionMarginRequirementParams {
        address owner;
        int24 tickLower;
        int24 tickUpper;
        bool isLM;
        int24 currentTick;
        uint256 termStartTimestamp;
        uint256 termEndTimestamp;
        uint128 liquidity;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        uint256 variableFactor;

        bytes32 rateOracleId;
        uint256 twapApy;
    }

    // function apyUpper() external view returns (uint256);

    // function apyLower() external view returns (uint256);

    // function apyUpperMultiplier() external view returns (uint256);

    // function apyLowerMultiplier() external view returns (uint256);

    // function minDeltaLM() external view returns (uint256);

    // function minDeltaIM() external view returns (uint256);

    function SECONDS_IN_YEAR() external view returns (uint256);

    // function maxLeverage() external view returns (uint256);

    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params
    ) external view returns (uint256 margin);

    function getMinNotional(address underlyingToken) external view returns (uint256 minNotional);    

    function isLiquidatablePosition(PositionMarginRequirementParams memory params, int256 currentMargin) external view returns(bool _isLiquidatable);

    function isLiquidatableTrader(
        TraderMarginRequirementParams memory params,
        int256 currentMargin
    ) external view returns(bool isLiquidatable);

    function getPositionMarginRequirement(PositionMarginRequirementParams memory params) external view returns (uint256 margin);

}
