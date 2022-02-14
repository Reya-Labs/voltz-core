// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./IVAMM.sol";
import "./IPositionStructs.sol";
import "../core_libraries/Position.sol";
import "./rate_oracles/IRateOracle.sol";

interface IMarginEngine is IPositionStructs {
    // structs

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
    event HistoricalApyWindowSet(uint256 secondsAgo);
    event CacheMaxAgeSet(uint256 cacheMaxAgeInSeconds);
    event IsInsuranceDepletedSet(bool isInsuranceDepleted);
    event MinMarginToIncentiviseLiquidatorsSet(
        uint256 minMarginToIncentiviseLiquidators
    );
    event CollectProtocol(address recipient, uint256 amount);
    event LiquidatorRewardSet(uint256 liquidatorRewardWad);
    event TraderPostVAMMInducedSwapUpdate(
        address recipient,
        int256 fixedTokenDelta,
        int256 variableTokenDelta,
        uint256 cumulativeFeeIncurred
    );
    event PositionTokenBalancesAndAccountForFeesUpdate(
        address owner,
        int256 fixedTokenDelta,
        int256 variableTokenDelta,
        uint256 feeDelta
    );

    // immutables

    function fcm() external view returns (address);

    // /// @notice The address of the underlying (non-yield bearing) pool token - e.g. USDC
    // /// @return The underlying pool token address
    function underlyingToken() external view returns (address);

    function rateOracleAddress() external view returns (address);

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

    function vammAddress() external view returns (address);

    /// @notice Returns the information about a position by the position's key
    /// @param owner The address of the position owner
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// Returns position The Position.Info corresponding to the equested position
    function getPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external view returns (Position.Info memory position);

    /// @notice Gets the look-back window size that's used to request the historical APY from the rate Oracle
    /// @dev The historical APY of the Rate Oracle is necessary for MarginEngine computations
    /// @dev The look-back window is seconds from the current timestamp
    /// @dev This value is only settable by the the Factory owner and may be unique for each MarginEngine
    /// @dev When setting secondAgo, the setter needs to take into consideration the underlying volatility of the APYs in the reference yield-bearing pool (e.g. Aave v2 USDC)
    /// @return secondsAgo in seconds
    function secondsAgo() external view returns (uint256); // @audit suffix with Wad, and move this to MarginEngine so that it can be different for different IRS durations

    /// @notice Sets secondsAgo: The look-back window size used to calculate the historical APY for margin purposes
    /// @param _secondsAgo the duration of the lookback window in seconds
    /// @dev Can only be set by the Factory Owner
    function setSecondsAgo(uint256 _secondsAgo) external;

    function setMarginCalculatorParameters(
        MarginCalculatorParameters memory _marginCalculatorParameters
    ) external;

    // function getMarginCalculatorParameters() external view returns (MarginCalculatorParameters memory _marginCalculatorParameters);

    function setIsInsuranceDepleted(bool _isInsuranceDepleted) external;

    // function setMinMarginToIncentiviseLiquidators(
    //     uint256 _minMarginToIncentiviseLiquidators
    // ) external;

    /// @notice Returns the information about a trader by the trader's key
    /// @param key The wallet address of the trader
    /// @return margin Margin (in terms of the underlying tokens) in the trader's Voltz account
    /// Returns fixedTokenBalance The fixed token balance of the tader, at the maturity this balance (if positive) can be redeemed for fixedTokenBalance * Term of the AMM in Years * 1%
    /// Returns variableTokenBalance The variable token balance of the tader, at the maturity this balance (if positive) can be redeemed for variableTokenBalance * Term of the AMM in Years * variable APY generated by the underlying varaible rates pool over the lifetime of the IRS AMM
    /// Returns settled A Trader is considered settled if after the maturity of the IRS AMM, the trader settled the IRS cash-flows generated by their fixed and variable token balances
    function traders(address key)
        external
        view
        returns (
            int256 margin,
            int256 fixedTokenBalance,
            int256 variableTokenBalance,
            bool settled
        );

    // non-view functions

    function setLiquidatorReward(uint256 _liquidatorRewardWad) external;

    /// @notice Updates Position Margin
    /// @dev Must be called by the owner of the position (unless marginDelta is positive?)
    /// @param params Values necessary for the purposes of the updating the Position Margin (owner, tickLower, tickUpper, liquidityDelta)
    /// @param marginDelta Determines the updated margin of the position where the updated margin = current margin + marginDelta
    function updatePositionMargin(
        IPositionStructs.ModifyPositionParams memory params,
        int256 marginDelta
    ) external;

    /// @notice Updates the sender's Trader Margin
    /// @dev Must be called by the trader address
    /// @param marginDelta Determines the updated margin of the trader where the updated margin = current margin + marginDelta
    function updateTraderMargin(address traderAddress, int256 marginDelta)
        external;

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
    /// @param params Values necessary for the purposes of referencing the position being settled (owner, tickLower, tickUpper, _)
    function settlePosition(IPositionStructs.ModifyPositionParams memory params)
        external;

    /// @notice Settles a Trader
    /// @dev Can be called by anyone
    /// @dev A Trader cannot be settled before IRS AMM maturity
    /// @dev Steps to settle: calculate settlement cashflow based on the fixed and variable balances of the trader, update the fixed and variable balances to 0, update the margin to account for IRS settlement cashflow
    function settleTrader(address traderAddress) external;

    /// @notice Liquidate a Position
    /// @dev Steps to liquidate: update position's fixed and variable token balances to account for balances accumulated throughout the trades made since the last mint/burn/poke,
    /// @dev Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator,
    /// @dev Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator, revert if that is not the case,
    /// @dev Calculate the liquidation reward = current margin of the position * liquidatorReward, subtract the liquidator reward from the position margin,
    /// @dev Burn the position's liquidity ==> not going to enter into new IRS contracts until the AMM maturity, transfer the reward to the liquidator
    /// @param params necessary for the purposes of referencing the position being liquidated (owner, tickLower, tickUpper, _)
    function liquidatePosition(
        IPositionStructs.ModifyPositionParams memory params
    ) external;

    /// @notice Liquidate a Trader
    /// @dev Steps to liquidate: check if the trader is liquidatable (revert if that is not the case),
    /// @dev Calculate liquidator reward, subtract it from the trader margin, unwind the trader, transfer the reward to the liquidator
    /// @param traderAddress The address of the trader being liquidated
    function liquidateTrader(address traderAddress) external;

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

    /// @notice Update Fixed and Variable Token Balances of a trader
    /// @dev Auth:
    /// @dev Steps taken:
    /// @dev 1. Update Fixed and Variable Token Balances of a trader
    /// @dev 2. Check if the initial margin requirement is still satisfied following the balances update, if that is not the case then revert
    /// @param recipient The address of the trader who wishes to update their balances
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    function updateTraderPostVAMMInducedSwap(
        address recipient,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 cumulativeFeeIncurred,
        uint160 sqrtPriceX96
    ) external;

    function updatePositionPostVAMMInducedSwap(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        int256 fixedTokenDelta,
        int256 variableTokenDelta,
        uint256 cumulativeFeeIncurred,
        int24 currentTick,
        uint160 sqrtPriceX96
    ) external;

    function collectProtocol(address recipient, uint256 amount) external;

    function setVAMMAddress(address _vAMMAddress) external;

    function setFCM(address _fcm) external;

    function transferMarginToFCMTrader(address _account, uint256 marginDelta)
        external;
}
