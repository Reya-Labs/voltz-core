pragma solidity ^0.8.0;

import "../../core_libraries/Trader.sol";


/// @title AMM actions
/// @notice Contains amm methods that can be called by anyone
interface IAmmActions {

    struct SwapParams {
        address recipient;
        bool isFT; // equivalent to !zeroForOne
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
        bool isUnwind;
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
    /// @param data Any data that should be passed through to the callback
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external;

    /// @notice Initiate an Interest Rate Swap Contract
    /// @param data Any data to be passed through to the callback
    function swap(
        SwapParams memory params,
        bytes calldata data
    ) external returns (Trader.Info memory trader);
}
