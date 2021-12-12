// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";

interface IMarginCalculator {

    // structs 

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

    // view functions


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

}
