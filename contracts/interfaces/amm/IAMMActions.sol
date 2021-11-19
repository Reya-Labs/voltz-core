pragma solidity ^0.8.0;

// import "../../core_libraries/Trader.sol";


/// @title AMM actions
/// @notice Contains amm methods that can be called by anyone
interface IAmmActions {

    struct SwapParams {
        address recipient;
        bool isFT; // equivalent to !zeroForOne
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
        bool isUnwind;
        bool isTrader;
        int256 proposedMargin;        
    }

    struct SwapCache {
        // liquidity at the beginning of the swap
        uint128 liquidityStart;
        // the timestamp of the current block
        uint256 blockTimestamp;
    }

    // the top level state of the swap, the results of which are recorded in storage at the end
    struct SwapState {
        // the amount remaining to be swapped in/out of the input/output asset
        int256 amountSpecifiedRemaining;
        // the amount already swapped out/in of the output/input asset
        int256 amountCalculated;
        // current sqrt(price)
        uint160 sqrtPriceX96;
        // the tick associated with the current price
        int24 tick;

        int256 fixedTokenGrowthGlobal;

        int256 variableTokenGrowthGlobal;

        // the current liquidity in range
        uint128 liquidity;
    }

    struct StepComputations {
        // the price at the beginning of the step
        uint160 sqrtPriceStartX96;
        // the next tick to swap to from the current tick in the swap direction
        int24 tickNext;
        // whether tickNext is initialized or not
        bool initialized;
        // sqrt(price) for the next tick (1/0)
        uint160 sqrtPriceNextX96;
        // how much is being swapped in in this step
        uint256 amountIn;
        // how much is being swapped out
        uint256 amountOut;

        int256 notionalAmount;
        int256 fixedRate;

        uint256 amount0;
        uint256 amount1;

    }

    struct InitiateIRSParams {
        // trader's address
        address traderAddress;
        // the lower and upper tick of the position

        int256 fixedTokenBalance;
        int256 variableTokenBalance;

        int256 margin;
        bool settled;
    }

    struct ModifyPositionParams {
        // the address that owns the position
        address owner;
        // the lower and upper tick of the position
        int24 tickLower;
        int24 tickUpper;
        // any change in liquidity
        int128 liquidityDelta;
    }

    
    struct UpdatePositionVars {
        
        bool flippedLower;
        bool flippedUpper;

        int256 fixedTokenGrowthInside;
        int256 variableTokenGrowthInside;
    }

    /// @notice Sets the initial price for the pool
    /// @dev Price is represented as a sqrt(amountToken1/amountToken0) Q64.96 value
    /// @param sqrtPriceX96 the initial sqrt price of the pool as a Q64.96
    function initialize(uint160 sqrtPriceX96) external;

    /// @notice Adds liquidity for the given recipient/tickLower/tickUpper position
    /// @dev The caller of this method receives a callback in the form of IUniswapV3MintCallback#uniswapV3MintCallback
    /// in which they must pay any token0 or token1 owed for the liquidity. The amount of token0/token1 due depends
    /// on tickLower, tickUpper, the amount of liquidity, and the current price.
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

    function swap(
        SwapParams memory params
    ) external returns (int256 _fixedTokenBalance, int256 _variableTokenBalance);
}
