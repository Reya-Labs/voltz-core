// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";

interface IMarginCalculator {

    // structs 

    // docs missing (collect them from MarginCalculator.sol old mappings)
    struct MarginCalculatorParameters {
        PRBMath.UD60x18 apyUpperMultiplier;
        PRBMath.UD60x18 apyLowerMultiplier;
        PRBMath.UD60x18 minDeltaLM;
        PRBMath.UD60x18 minDeltaIM;
        PRBMath.UD60x18 maxLeverage;
        PRBMath.SD59x18 sigmaSquared;
        PRBMath.SD59x18 alpha;
        PRBMath.SD59x18 beta;
        PRBMath.SD59x18 xiUpper;
        PRBMath.SD59x18 xiLower;
    }

    struct ApyBoundVars {
        /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t) where t is the maturity timestamp, s is the current timestamp and beta is a diffusion process parameter set via calibration
        PRBMath.SD59x18 timeFactor;
        /// @dev 1 - timeFactor
        PRBMath.SD59x18 oneMinusTimeFactor;
        /// @dev k = (alpha/sigmaSquared)
        PRBMath.SD59x18 k;
        /// @dev zeta = (sigmaSquared*(1-timeFactor))/beta
        PRBMath.SD59x18 zeta;
        PRBMath.SD59x18 lambdaNum;
        PRBMath.SD59x18 lambdaDen;
        /// @dev lambda = lambdaNum/lambdaDen = (beta*timeFactor)*twapAPY / (sigmaSquared*(1-timeFactor))
        PRBMath.SD59x18 lambda;
        /// @dev critical value from the normal distribution (refer to the litepaper, equations 12 and 13)
        PRBMath.SD59x18 criticalValueMultiplier;
        /// @dev critical value = sqrt(2(k+2*lambda))
        PRBMath.SD59x18 criticalValue;
    }

    struct LPMarginParams {
        /// @dev sqrtRatioLower sqrt(y/x) where y/x is the lowest ratio of virtual variable to fixed tokens in the vAMM at which the LP's position is active
        uint160 sqrtRatioLower;
        /// @dev sqrtRatioUpper sqrt(y/x) where y/x is the highest ratio of virtual variable to fixed tokens in the vAMM at which the LP's position is active
        uint160 sqrtRatioUpper;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev total liquidity deposited by a position
        uint128 liquidity;
        /// @dev timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
    }

    struct TraderMarginRequirementParams {
        /// @dev current fixedToken balance of a given trader
        int256 fixedTokenBalance;
        /// @dev current variableToken balance of a given trader
        int256 variableTokenBalance;
        /// @dev timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
        bytes32 rateOracleId;
        /// @dev Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
        uint256 twapApy;
    }

    struct PositionMarginRequirementParams {
        /// @dev Position owner
        address owner;
        /// @dev The lower tick of the position
        int24 tickLower;
        /// @dev The upper tick of the position
        int24 tickUpper;
        /// @dev isLM = true => Liquidation Margin is calculated, isLM = false => Initial Margin is calculated
        bool isLM;
        /// @dev Current tick in the Virtual Automated Market Maker
        int24 currentTick;
        /// @dev Timestamp of the IRS AMM initiation (18 decimals)
        uint256 termStartTimestamp;
        /// @dev Timestamp of the IRS AMM maturity (18 decimals)
        uint256 termEndTimestamp;
        /// @dev Amount of active liquidity of a position
        uint128 liquidity;
        /// @dev Curren Fixed Token Balance of a position
        /// @dev In order for this value to be up to date, the Position needs to first check what the fixedTokenGrowthInside is within their tick range and then calculate accrued fixedToken flows since the last check
        int256 fixedTokenBalance;
        /// @dev Curren Variabe Token Balance of a position
        int256 variableTokenBalance;
        /// @dev Variable Factor is the variable rate from the IRS AMM initiation and until IRS AMM maturity (when computing margin requirements)
        uint256 variableFactor;
        /// @dev A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
        bytes32 rateOracleId;
        /// @dev Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
        uint256 twapApy;
    }

    struct MinimumMarginRequirementLocalVars {

        /// @dev Minimum possible absolute APY delta between the underlying pool and the fixed rate of a given IRS contract, used as a safety measure. 
        /// @dev minDelta is different depending on whether we are calculating a Liquidation or an Initial Margin Requirement 
        uint256 minDelta;
        /// @dev notional is the absolute value of the variable token balance
        uint256 notional;
        /// @dev timeInSeconds = termEndTimestamp - termStartTimestamp of the IRS AMM
        uint256 timeInSeconds;
        /// @dev timeInYears = timeInSeconds / SECONDS_IN_YEAR (where SECONDS_IN_YEAR=31536000)
        uint256 timeInYears;
        /// @dev Only relevant for Variable Takers, since the worst case scenario for them if the variable rates are at the zero lower bound, assuming the APY in the underlying yield-bearing pool can never be negative
        /// @dev zeroLowerBoundMargin = abs(fixedTokenBalance) * timeInYears * 1%
        uint256 zeroLowerBoundMargin;
    }


    struct PositionMarginRequirementsVars {
        /// @dev virtual 1% fixed tokens supported by the position in a given tick range with a given amount of supplied liquidity
        /// @dev amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioAtLowerTick, sqrtRatioAtUpperTick, positionLiquidity)
        int256 amount0;
        /// @dev virtual variable tokens supported by the position in a given tick range with a given amount of supplied liquidity
        /// @dev amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAtLowerTick, sqrtRatioAtUpperTick, positionLiquidity)
        int256 amount1;
        /// @dev the exepected variable token balance of a liquidity provider if the Voltz traders were to completely consume all of the variable liquidty offered by the LP in a given tick range 
        int256 expectedVariableTokenBalance;
        /// @dev the exepected fixed token balance of a liquidity provider if the Voltz traders were to completely consume all of the fixed liquidty offered by the LP in a given tick range 
        int256 expectedFixedTokenBalance;
        /// @dev If the current tick is within the tick range boundaries of the position then amount0Up represents the amount0 delta following a trade that pushes the tick to the tickUpper of the position
        int256 amount0Up;
        /// @dev If the current tick is within the tick range boundaries of the position then amount1Up represents the amount1 delta following a trade that pushes the tick to the tickUpper of the position
        int256 amount1Up;
        /// @dev If the current tick is within the tick range boundaries of the position then amount0Down represents the amount0 delta following a trade that pushes the tick to the tickLower of the position
        int256 amount0Down;
        /// @dev If the current tick is within the tick range boundaries of the position then amount1Down represents the amount1 delta following a trade that pushes the tick to the tickLower of the position
        int256 amount1Down;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedVariableTokenBalanceAfterUp is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickUpper of the position
        int256 expectedVariableTokenBalanceAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedFixedTokenBalanceAfterUp is the the exepected fixed token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickUpper of the position
        int256 expectedFixedTokenBalanceAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedVariableTokenBalanceAfterDown is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickLower of the position
        int256 expectedVariableTokenBalanceAfterDown;
        /// @dev If the current tick is within the tick range boundaries of the position then expectedFixedTokenBalanceAfterDown is the the exepected variable token balance of a liquidity provider if the Voltz traders were to trade and push the tick to the tickLower of the position
        int256 expectedFixedTokenBalanceAfterDown;
        /// @dev If the current tick is within the tick range boundaries of the position then marginReqAfterUp is the margin requirement (either liquidation or initial) if the traders were to push the tick to the tickUpper of the position
        uint256 marginReqAfterUp;
        /// @dev If the current tick is within the tick range boundaries of the position then marginReqAfterDown is the margin requirement (either liquidation or initial) if the traders were to push the tick to the tickLower of the position
        uint256 marginReqAfterDown;
        /// @dev Liquidation or Initial Margin Requirement of a Position
        int256 margin;
    }

    // view functions

    /// @notice Returns the Minimum Margin Requirement
    /// @dev As a safety measure, Voltz Protocol also computes the minimum margin requirement for FTs and VTs.
    /// @dev This ensures the protocol has a cap on the amount of leverage FTs and VTs can take
    /// @dev Minimum Margin = abs(varaibleTokenBalance) * minDelta * t
    /// @dev minDelta is a parameter that is set separately for FTs and VTs and it is free to vary depending on the underlying rates pool
    /// @dev Also the minDelta is different for Liquidation and Initial Margin Requirements
    /// @dev where minDeltaIM > minDeltaLM
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens    
    function getMinimumMarginRequirement(
        TraderMarginRequirementParams memory params
    ) external view returns(uint256 margin);

    /// @notice Returns either the Liquidation or Initial Margin Requirement of a given trader
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @return margin Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens
    function getTraderMarginRequirement(
        TraderMarginRequirementParams memory params
    ) external view returns (uint256 margin);

    function getPositionMarginRequirement(PositionMarginRequirementParams memory params) external view returns (uint256 margin);

    /// @notice Checks if a given position is liquidatable
    /// @dev In order for a position to be liquidatable its current margin needs to be lower than the position's liquidation margin requirement
    /// @return _isLiquidatable A boolean which suggests if a given position is liquidatable
    function isLiquidatablePosition(PositionMarginRequirementParams memory params, int256 currentMargin) external view returns(bool _isLiquidatable);

    /// @notice Checks if a given trader is liquidatable
    /// @param params Values necessary for the purposes of the computation of the Trader Margin Requirement
    /// @param currentMargin Current margin of a trader in terms of the underlying tokens (18 decimals)
    /// @return isLiquidatable A boolean which suggests if a given trader is liquidatable
    function isLiquidatableTrader(
        TraderMarginRequirementParams memory params,
        int256 currentMargin
    ) external view returns(bool isLiquidatable);

    function setMarginCalculatorParameters(MarginCalculatorParameters memory marginCalculatorParameters, bytes32 rateOracleId) external;

    function setTimeFactor(bytes32 rateOracleId, uint256 timeInDays, int256 timeFactor) external;

}
