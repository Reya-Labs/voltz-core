// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./IMarginEngine.sol";
import "./IPositionStructs.sol";

interface IVAMM is IPositionStructs {
    // events
    event Swap(
        address indexed sender,
        address indexed recipient,
        uint160 sqrtPriceX96,
        uint128 liquidity,
        int24 tick
    );

    /// @dev emitted after a given vamm is successfully initialized
    event Initialize(uint160 sqrtPriceX96, int24 tick);

    /// @dev emitted after a successful minting of a given LP position
    event Mint(
        address sender,
        address indexed owner,
        int24 indexed tickLower,
        int24 indexed tickUpper,
        uint128 amount
    );

    // errors

    /// @dev There are not enough funds available for the requested operation
    error NotEnoughFunds(uint256 requested, uint256 available);

    /// @dev The two values were expected to have oppostite sigs, but do not
    error ExpectedOppositeSigns(int256 amount0, int256 amount1);

    /// @dev Error which is reverted if the sqrt price of the vamm is non-zero before a vamm is initialized
    error ExpectedSqrtPriceZeroBeforeInit(uint160 sqrtPriceX96);

    /// @dev Error which ensures the liquidity delta is positive if a given LP wishes to mint further liquidity in the vamm
    error LiquidityDeltaMustBePositiveInMint(uint128 amount);

    /// @dev Error which ensures the liquidity delta is positive if a given LP wishes to burn liquidity in the vamm
    error LiquidityDeltaMustBePositiveInBurn(uint128 amount);

    /// @dev Error which ensures the amount of notional specified when initiating an IRS contract (via the swap function in the vamm) is non-zero
    error IRSNotionalAmountSpecifiedMustBeNonZero(int256 amountSpecified);

    /// @dev Error which ensures the VAMM is unlocked
    error CanOnlyTradeIfUnlocked(bool unlocked);

    error OnlyMarginEngine();

    // structs

    struct VAMMVars {
        /// @dev the current sqrt price in the vamm
        uint160 sqrtPriceX96;
        /// @dev the current tick in the vamm
        int24 tick;
        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        // represented as an integer denominator (1/x)%
        uint8 feeProtocol;
    }

    struct SwapParams {
        /// @dev Address of the trader initiating the swap
        address recipient;
        /// @dev is a given swap initiated by a fixed taker vs. a variable taker
        bool isFT;
        /// @dev The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
        int256 amountSpecified;
        /// @dev The Q64.96 sqrt price limit. If !isFT, the price cannot be less than this
        uint160 sqrtPriceLimitX96;
        /// @dev Is the swap triggered following a liquidation event resulting in an unwind or swap triggered by the FCM
        bool isExternal;
        /// @dev Is the swap triggered by a trader. If this is false then this is only possible in a scenario where a liquidity provider's position is liquidated
        /// @dev leading to an unwind of a liquidity provider
        /// @dev lower tick of the liquidity provider (needs to be set if isTrader is false)
        int24 tickLower;
        /// @dev upper tick of the liqudiity provider (needs to be set if isTrader is false)
        int24 tickUpper;
    }

    struct SwapCache {
        /// @dev liquidity at the beginning of the swap
        uint128 liquidityStart;
        /// @dev the timestamp of the current block (in wei)
        uint256 blockTimestamp;
        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        // represented as an integer denominator (1/x)%
        uint8 feeProtocol;
    }

    /// @dev the top level state of the swap, the results of which are recorded in storage at the end
    struct SwapState {
        /// @dev the amount remaining to be swapped in/out of the input/output asset
        int256 amountSpecifiedRemaining;
        /// @dev the amount already swapped out/in of the output/input asset
        int256 amountCalculated;
        /// @dev current sqrt(price)
        uint160 sqrtPriceX96;
        /// @dev the tick associated with the current price
        int24 tick;
        /// @dev the global fixed token growth
        int256 fixedTokenGrowthGlobalX128;
        /// @dev the global variable token growth
        int256 variableTokenGrowthGlobalX128;
        /// @dev the current liquidity in range
        uint128 liquidity;
        /// @dev the global fee growth of the underlying token
        uint256 feeGrowthGlobalX128;
        /// @dev amount of underlying token paid as protocol fee
        uint256 protocolFee;
        /// @dev cumulative fee incurred while initiating a swap
        uint256 cumulativeFeeIncurred;
        /// @dev ...
        int256 fixedTokenDeltaCumulative;
        /// @dev ...
        int256 variableTokenDeltaCumulative;
    }

    struct StepComputations {
        /// @dev the price at the beginning of the step
        uint160 sqrtPriceStartX96;
        /// @dev the next tick to swap to from the current tick in the swap direction
        int24 tickNext;
        /// @dev whether tickNext is initialized or not
        bool initialized;
        /// @dev sqrt(price) for the next tick (1/0)
        uint160 sqrtPriceNextX96;
        /// @dev how much is being swapped in in this step
        uint256 amountIn;
        /// @dev how much is being swapped out
        uint256 amountOut;
        /// @dev how much fee is being paid in (underlying token)
        uint256 feeAmount;
        /// @dev ...
        uint256 feeProtocolDelta;
        /// @dev ...
        int256 fixedTokenDeltaUnbalanced; // for LP
        /// @dev ...
        int256 fixedTokenDelta; // for LP
        /// @dev ...
        int256 variableTokenDelta; // for LP
    }

    /// @dev "constructor" for proxy instances
    function initialize(address _marginEngineAddress) external;

    // immutables

    /// @notice The vamm's fee (proportion) in wei
    /// @return The fee in wei
    function feeWad() external view returns (uint256);

    /// @notice whether the vamm is locked
    /// @return The boolean, true if the vamm is unlocked
    function unlocked() external view returns (bool);

    /// @notice The vamm tick spacing
    /// @dev Ticks can only be used at multiples of this value, minimum of 1 and always positive
    /// e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ...
    /// This value is an int24 to avoid casting even though it is always positive.
    /// @return The tick spacing
    function tickSpacing() external view returns (int24);

    /// @notice The maximum amount of position liquidity that can use any tick in the range
    /// @dev This parameter should be enforced per tick (when setting) to prevent liquidity from overflowing a uint128 at any point, and
    /// also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to the vamm
    /// @return The max amount of liquidity per tick
    function maxLiquidityPerTick() external view returns (uint128);

    // state variables

    /// @return sqrtPriceX96 The current price of the pool as a sqrt(variableToken/fixedToken) Q64.96 value
    /// @return tick The current tick of the vamm, i.e. according to the last tick transition that was run.
    /// @return feeProtocol feeProtocol
    function vammVars()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint8 feeProtocol
        );

    /// @notice The fixed token growth in wei, accumulated per unit of liquidity for the entire life of the vamm
    /// @dev This value can overflow the uint256
    function fixedTokenGrowthGlobalX128() external view returns (int256);

    /// @notice The variable token growth in wei, accumulated per unit of liquidity for the entire life of the vamm
    /// @dev This value can overflow the uint256
    function variableTokenGrowthGlobalX128() external view returns (int256);

    /// @notice The fee growth in wei, collected per unit of liquidity for the entire life of the vamm
    /// @dev This value can overflow the uint256
    function feeGrowthGlobalX128() external view returns (uint256);

    /// @notice The currently in range liquidity available to the vamm
    function liquidity() external view returns (uint128);

    /// @notice The amount underlying token that are owed to the protocol
    /// @dev Protocol fees will never exceed uint256
    function protocolFees() external view returns (uint256);

    function marginEngine() external view returns (IMarginEngine);

    /// @notice Function that sets the feeProtocol of the vamm
    function setFeeProtocol(uint8 feeProtocol) external;

    /// @notice Function that sets the tickSpacing of the vamm
    function setTickSpacing(int24 _tickSpacing) external;

    /// @notice Function that sets the maxLiquidityPerTick of the vamm
    function setMaxLiquidityPerTick(uint128 _maxLiquidityPerTick) external;

    /// @notice Function that sets fee of the vamm
    function setFee(uint256 _fee) external;

    /// @notice Updates internal accounting to reflect a collection of protocol fees. The actual transfer of fees must happen separately in the AMM
    /// @dev can only be done via the collectProtocol function of the parent AMM of the vamm
    function updateProtocolFees(uint256 protocolFeesCollected) external;

    /// @notice Sets the initial price for the vamm
    /// @dev Price is represented as a sqrt(amountVariableToken/amountFixedToken) Q64.96 value
    /// @param sqrtPriceX96 the initial sqrt price of the vamm as a Q64.96
    function initializeVAMM(uint160 sqrtPriceX96) external;

    function burn(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external;

    /// @notice Adds liquidity for the given recipient/tickLower/tickUpper position
    /// @param recipient The address for which the liquidity will be created
    /// @param tickLower The lower tick of the position in which to add liquidity
    /// @param tickUpper The upper tick of the position in which to add liquidity
    /// @param amount The amount of liquidity to mint
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external;

    /// @notice Initiate an Interest Rate Swap
    /// @param params SwapParams necessary to initiate an Interest Rate Swap
    /// @return _fixedTokenDelta Fixed Token Delta
    /// @return _variableTokenDelta Variable Token Delta
    /// @return _cumulativeFeeIncurred Cumulative Fee Incurred
    function swap(SwapParams memory params)
        external
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred
        );

    /// @notice Look up information about a specific tick in the amm
    /// @param tick The tick to look up
    /// @return liquidityGross the total amount of position liquidity that uses the vamm either as tick lower or
    /// tick upper,
    /// liquidityNet how much liquidity changes when the vamm price crosses the tick,
    /// feeGrowthOutsideX128 the fee growth on the other side of the tick from the current tick in underlying token
    /// i.e. if liquidityGross is greater than 0. In addition, these values are only relative.
    function ticks(int24 tick)
        external
        view
        returns (
            uint128 liquidityGross,
            int128 liquidityNet,
            int256 fixedTokenGrowthOutside,
            int256 variableTokenGrowthOutside,
            uint256 feeGrowthOutside,
            bool initialized
        );

    /// @notice Returns 256 packed tick initialized boolean values. See TickBitmap for more information
    function tickBitmap(int16 wordPosition) external view returns (uint256);

    /// @notice Computes the current fixed and variable token growth inside a given tick range given the current tick in the vamm
    /// @param tickLower The lower tick of the position
    /// @param tickUpper The upper tick of the position
    /// @return fixedTokenGrowthInsideX128 Fixed Token Growth inside the given tick range
    /// @return variableTokenGrowthInsideX128 Variable Token Growth inside the given tick range
    /// @return feeGrowthInsideX128 Fee Growth Inside given tick range
    function computeGrowthInside(int24 tickLower, int24 tickUpper)
        external
        view
        returns (
            int256 fixedTokenGrowthInsideX128,
            int256 variableTokenGrowthInsideX128,
            uint256 feeGrowthInsideX128
        );
}
