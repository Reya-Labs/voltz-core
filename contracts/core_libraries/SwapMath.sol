pragma solidity ^0.8.0;

import "../utils/FullMath.sol";
import "../utils/SqrtPriceMath.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";

/// @title Computes the result of a swap within ticks
/// @notice Contains methods for computing the result of a swap within a single tick price range, i.e., a single tick.
library SwapMath {
    /// @notice Computes the result of swapping some amount in, or amount out, given the parameters of the swap
    /// @dev The fee, plus the amount in, will never exceed the amount remaining if the swap's `amountSpecified` is positive
    /// @param sqrtRatioCurrentX96 The current sqrt price of the pool
    /// @param sqrtRatioTargetX96 The price that cannot be exceeded, from which the direction of the swap is inferred
    /// @param liquidity The usable liquidity
    /// @param amountRemaining How much input or output amount is remaining to be swapped in/out
    /// @return sqrtRatioNextX96 The price after swapping the amount in/out, not to exceed the price target
    /// @return amountIn The amount to be swapped in, of either token0 or token1, based on the direction of the swap
    /// @return amountOut The amount to be received, of either token0 or token1, based on the direction of the swa
    function computeSwapStep(
        uint160 sqrtRatioCurrentX96,
        uint160 sqrtRatioTargetX96,
        uint128 liquidity,
        int256 amountRemaining
    )
        internal
        pure
        returns (
            uint160 sqrtRatioNextX96,
            uint256 amountIn,
            uint256 amountOut,

            int256 notionalAmount,
            int256 fixedRate,

            uint256 amount0,
            uint256 amount1
        )
    {
        bool zeroForOne = sqrtRatioCurrentX96 >= sqrtRatioTargetX96;
        bool exactIn = amountRemaining >= 0;

        if (exactIn) {
            amountIn = zeroForOne
                ? SqrtPriceMath.getAmount0Delta(
                    sqrtRatioTargetX96,
                    sqrtRatioCurrentX96,
                    liquidity,
                    true
                )
                : SqrtPriceMath.getAmount1Delta(
                    sqrtRatioCurrentX96,
                    sqrtRatioTargetX96,
                    liquidity,
                    true
                );
            if (uint256(amountRemaining) >= amountIn)
                sqrtRatioNextX96 = sqrtRatioTargetX96;
            else
                sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
                    sqrtRatioCurrentX96,
                    liquidity,
                    uint256(amountRemaining),
                    zeroForOne
                );
        } else {
            amountOut = zeroForOne
                ? SqrtPriceMath.getAmount1Delta(
                    sqrtRatioTargetX96,
                    sqrtRatioCurrentX96,
                    liquidity,
                    false
                )
                : SqrtPriceMath.getAmount0Delta(
                    sqrtRatioCurrentX96,
                    sqrtRatioTargetX96,
                    liquidity,
                    false
                );
            if (uint256(-amountRemaining) >= amountOut)
                sqrtRatioNextX96 = sqrtRatioTargetX96;
            else
                sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
                    sqrtRatioCurrentX96,
                    liquidity,
                    uint256(-amountRemaining),
                    zeroForOne
                );
        }

        bool max = sqrtRatioTargetX96 == sqrtRatioNextX96;

        // get the input/output amounts
        if (zeroForOne) {
            amountIn = max && exactIn
                ? amountIn
                : SqrtPriceMath.getAmount0Delta(
                    sqrtRatioNextX96,
                    sqrtRatioCurrentX96,
                    liquidity,
                    true
                );
            amountOut = max && !exactIn
                ? amountOut
                : SqrtPriceMath.getAmount1Delta(
                    sqrtRatioNextX96,
                    sqrtRatioCurrentX96,
                    liquidity,
                    false
                );
        } else {
            amountIn = max && exactIn
                ? amountIn
                : SqrtPriceMath.getAmount1Delta(
                    sqrtRatioCurrentX96,
                    sqrtRatioNextX96,
                    liquidity,
                    true
                );
            amountOut = max && !exactIn
                ? amountOut
                : SqrtPriceMath.getAmount0Delta(
                    sqrtRatioCurrentX96,
                    sqrtRatioNextX96,
                    liquidity,
                    false
                );
        }

        // cap the output amount to not exceed the remaining output amount
        if (!exactIn && amountOut > uint256(-amountRemaining)) {
            amountOut = uint256(-amountRemaining);
        }

        PRBMath.SD59x18 memory amount0UD = PRBMath.SD59x18({value: int256(amountIn)});
        PRBMath.SD59x18 memory amount1UD = PRBMath.SD59x18({value: int256(amountOut)});
        
        if (zeroForOne) {

            amount0UD = PRBMath.SD59x18({value: int256(amountIn)});
            amount1UD = PRBMath.SD59x18({value: int256(amountOut)});

            notionalAmount = -amount1UD.value;

        } else {

            // isFT
            
            amount0UD = PRBMath.SD59x18({value: int256(amountOut)});
            amount1UD = PRBMath.SD59x18({value: int256(amountIn)});

            notionalAmount = amount1UD.value;
            
        }

        PRBMath.SD59x18 memory fixedRateUD = PRBMathSD59x18Typed.mul(
            PRBMathSD59x18Typed.div(amount0UD, amount1UD),
            PRBMath.SD59x18({value: 10**16})
        );
        
        
        fixedRate = fixedRateUD.value;

        amount0 = uint256(amount0UD.value);
        amount1 = uint256(amount1UD.value);
        
    }
}
