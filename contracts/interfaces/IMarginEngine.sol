// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./IVAMM.sol";
import "./IPositionStructs.sol";
import "../core_libraries/Position.sol";
import "./rate_oracles/IRateOracle.sol";
import "./IFCM.sol";

interface IMarginEngine is IPositionStructs {
    // structs

    struct PositionMarginRequirementLocalVars {
        int256 scenario1LPVariableTokenBalance;
        int256 scenario1LPFixedTokenBalance;
        int256 scenario2LPVariableTokenBalance;
        int256 scenario2LPFixedTokenBalance;
        int256 amount0FromTickLowerToTickUpper;
        int256 amount1FromTickLowerToTickUpper;
        int256 amount0FromCurrentTickToTickUpper;
        int256 amount1FromCurrentTickToTickUpper;
        int256 amount0FromCurrentTickToTickLower;
        int256 amount1FromCurrentTickToTickLower;
        int256 amount0FromTickUpperToTickLower;
        int256 amount1FromTickUpperToTickLower;
        uint160 scenario1SqrtPriceX96;
        uint160 scenario2SqrtPriceX96;
        uint256 scenario1MarginRequirement;
        uint256 scenario2MarginRequirement;
    }

    struct MarginCalculatorParameters {
        /// @dev Upper bound of the underlying pool (e.g. Aave v2 USDC lending pool) APY from the initiation of the IRS AMM and until its maturity (18 decimals fixed point number)
        uint256 apyUpperMultiplierWad;
        /// @dev Lower bound of the underlying pool (e.g. Aave v2 USDC lending pool) APY from the initiation of the IRS AMM and until its maturity (18 decimals)
        uint256 apyLowerMultiplierWad;
        /// @dev The volatility of the underlying pool APY (settable by the owner of the Margin Engine) (18 decimals)
        int256 sigmaSquaredWad;
        /// @dev Margin Engine Parameter estimated via CIR model calibration (for details refer to litepaper) (18 decimals)
        int256 alphaWad;
        /// @dev Margin Engine Parameter estimated via CIR model calibration (for details refer to litepaper) (18 decimals)
        int256 betaWad;
        /// @dev Standard normal critical value used in the computation of the Upper APY Bound of the underlying pool
        int256 xiUpperWad;
        /// @dev Standard normal critical value used in the computation of the Lower APY Bound of the underlying pool
        int256 xiLowerWad;
        /// @dev Max term possible for a Voltz IRS AMM in seconds (18 decimals)
        int256 tMaxWad;
        /// @dev
        uint256 devMulLeftUnwindLMWad;
        uint256 devMulRightUnwindLMWad;
        uint256 devMulLeftUnwindIMWad;
        uint256 devMulRightUnwindIMWad;
        /// @dev

        uint256 fixedRateDeviationMinLeftUnwindLMWad;
        uint256 fixedRateDeviationMinRightUnwindLMWad;
        uint256 fixedRateDeviationMinLeftUnwindIMWad;
        uint256 fixedRateDeviationMinRightUnwindIMWad;
        /// @dev
        uint256 gammaWad;
        uint256 minMarginToIncentiviseLiquidators;
    }

    // Events
    event HistoricalApyWindowSet(
        uint256 blockTimestampScaled,
        address source,
        uint256 secondsAgo
    );
    event CacheMaxAgeSet(
        uint256 blockTimestampScaled,
        address source,
        uint256 cacheMaxAgeInSeconds
    );
    event IsInsuranceDepletedSet(
        uint256 blockTimestampScaled,
        address source,
        bool isInsuranceDepleted
    );
    event MinMarginToIncentiviseLiquidatorsSet(
        uint256 blockTimestampScaled,
        address source,
        uint256 minMarginToIncentiviseLiquidators
    );
    event CollectProtocol(
        uint256 blockTimestampScaled,
        address source,
        address recipient,
        uint256 amount
    );
    event LiquidatorRewardSet(
        uint256 blockTimestampScaled,
        address source,
        uint256 liquidatorRewardWad
    );
    event TraderPostVAMMInducedSwapUpdate(
        uint256 blockTimestampScaled,
        address source,
        address recipient,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 cumulativeFeeIncurred
    );
    event PositionTokenBalancesAndAccountForFeesUpdate(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 feeDelta
    );
    event SettleTrader(
        uint256 blockTimestampScaled,
        address source,
        address traderAddress
    );
    event SettlePosition(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info
    );
    event BalancesViaDeltasUpdate(
        uint256 blockTimestampScaled,
        address source,
        int256 fixedTokenBalance,
        int256 variableTokenBalance
    );
    event FixedAndVariableTokenGrowthInsideUpdate(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info,
        int256 fixedTokenGrowthInsideX128,
        int256 variableTokenGrowthInsideX128
    );
    event FeeGrowthInsideUpdate(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info,
        uint256 feeGrowthInsideX128
    );
    event LiquidityUpdate(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info,
        uint128 liquidity
    );
    event MarginViaDeltaUpdate(
        uint256 blockTimestampScaled,
        address source,
        Position.Info info,
        int256 margin
    );

    // immutables

    function fcm() external view returns (IFCM);

    // /// @notice The address of the underlying (non-yield bearing) pool token - e.g. USDC
    // /// @return The underlying pool token address
    function underlyingToken() external view returns (address);

    function rateOracle() external view returns (IRateOracle);

    function termStartTimestampWad() external view returns (uint256);

    function termEndTimestampWad() external view returns (uint256);

    // errors

    /// @dev No need to unwind a net zero position
    error PositionNetZero();

    /// @dev Cannot have less margin than the minimum requirement
    error MarginLessThanMinimum();

    /// @dev Trader's margin cannot be updated unless the trader is settled
    error TraderNotSettled();

    /// @dev We can't withdraw more margin than we have
    error WithdrawalExceedsCurrentMargin();

    /// @dev Position must be burned after AMM has reached maturity
    error PositionNotBurned();

    /// @dev Position must be settled after AMM has reached maturity
    error PositionNotSettled();

    /// @dev "constructor" for proxy instances
    function initialize(
        address _underlyingToken,
        address _rateOracleAddress,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
    ) external;

    // view functions

    function liquidatorRewardWad() external view returns (uint256);

    function vamm() external view returns (IVAMM);

    /// @notice Returns the information about a position by the position's key
    /// @param _owner The address of the position owner
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// Returns position The Position.Info corresponding to the equested position
    function getPosition(
        address _owner,
        int24 tickLower,
        int24 tickUpper
    ) external view returns (Position.Info memory position);

    /// @notice Gets the look-back window size that's used to request the historical APY from the rate Oracle
    /// @dev The historical APY of the Rate Oracle is necessary for MarginEngine computations
    /// @dev The look-back window is seconds from the current timestamp
    /// @dev This value is only settable by the the Factory owner and may be unique for each MarginEngine
    /// @dev When setting secondAgo, the setter needs to take into consideration the underlying volatility of the APYs in the reference yield-bearing pool (e.g. Aave v2 USDC)
    /// @return secondsAgo in seconds
    function secondsAgo() external view returns (uint256); // @audit suffix with Wad

    /// @notice Sets secondsAgo: The look-back window size used to calculate the historical APY for margin purposes
    /// @param _secondsAgo the duration of the lookback window in seconds
    /// @dev Can only be set by the Factory Owner
    function setSecondsAgo(uint256 _secondsAgo) external;

    function setMarginCalculatorParameters(
        MarginCalculatorParameters memory _marginCalculatorParameters
    ) external;

    function setIsInsuranceDepleted(bool _isInsuranceDepleted) external;

    // non-view functions

    function setLiquidatorReward(uint256 _liquidatorRewardWad) external;

    function updatePositionMargin(
        address _owner,
        int24 tickLower,
        int24 tickUpper,
        int256 marginDelta
    ) external;

    /// @notice Settles a Position
    /// @dev Can be called by anyone
    /// @dev A position cannot be settled before maturity
    /// @dev Steps to settle a position:
    /// @dev 1. Retrieve the current fixed and variable token growth inside the tick range of a position
    /// @dev 2. Calculate accumulated fixed and variable balances of the position since the last mint/poke/burn
    /// @dev 3. Update the postion's fixed and variable token balances
    /// @dev 4. Update the postion's fixed and varaible token growth inside last to enable future updates
    /// @dev 5. Calculates the settlement cashflow from all of the IRS contracts the position has entered since entering the AMM
    /// @dev 6. Updates the fixed and variable token balances of the position to be zero, adds the settlement cashflow to the position's current margin
    function settlePosition(
        int24 tickLower,
        int24 tickUpper,
        address _owner
    ) external;

    /// @notice Liquidate a Position
    /// @dev Steps to liquidate: update position's fixed and variable token balances to account for balances accumulated throughout the trades made since the last mint/burn/poke,
    /// @dev Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator,
    /// @dev Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator, revert if that is not the case,
    /// @dev Calculate the liquidation reward = current margin of the position * liquidatorReward, subtract the liquidator reward from the position margin,
    /// @dev Burn the position's liquidity ==> not going to enter into new IRS contracts until the AMM maturity, transfer the reward to the liquidator
    function liquidatePosition(
        int24 tickLower,
        int24 tickUpper,
        address _owner
    ) external;

    /// @notice Update a Position
    /// @dev Steps taken:
    /// @dev 1. Update position liquidity based on params.liquidityDelta
    /// @dev 2. Update fixed and variable token balances of the position based on how much has been accumulated since the last mint/burn/poke
    /// @dev 3. Update position's margin by taking into account the position accumulated fees since the last mint/burnpoke
    /// @dev 4. Update fixed and variable token growth + fee growth in the position info struct for future interactions with the position
    /// @param params necessary for the purposes of referencing the position being updated (owner, tickLower, tickUpper, _)
    function updatePositionPostVAMMInducedMintBurn(
        IPositionStructs.ModifyPositionParams memory params
    ) external;

    function updatePositionPostVAMMInducedSwap(
        address _owner,
        int24 tickLower,
        int24 tickUpper,
        int256 fixedTokenDelta,
        int256 variableTokenDelta,
        uint256 cumulativeFeeIncurred
    ) external;

    function collectProtocol(address recipient, uint256 amount) external;

    function setVAMM(address _vAMMAddress) external;

    function setFCM(address _fcm) external;

    function transferMarginToFCMTrader(address _account, uint256 marginDelta)
        external;
}
