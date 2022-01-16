// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/FullMath.sol";
import "../utils/SqrtPriceMath.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "../core_libraries/FixedAndVariableMath.sol";

/// @title Computes the result of a swap within ticks
/// @notice Contains methods for computing the result of a swap within a single tick price range, i.e., a single tick.
library SwapMath {
    function computeFeeAmount(
        uint256 notionalWad,
        uint256 timeToMaturityInSecondsWad,
        uint256 feePercentageWad
    ) internal pure returns (uint256 feeAmount) {
        uint256 timeInYearsWad = FixedAndVariableMath.accrualFact(
            timeToMaturityInSecondsWad
        );

        uint256 feeAmountWad = PRBMathUD60x18.mul(
            notionalWad,
            PRBMathUD60x18.mul(feePercentageWad, timeInYearsWad)
        );

        feeAmount = PRBMathUD60x18.toUint(feeAmountWad);
    }

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
        int256 amountRemaining,
        uint256 feePercentageWad,
        uint256 timeToMaturityInSecondsWad
    )
        internal
        pure
        returns (
            uint160 sqrtRatioNextX96,
            uint256 amountIn,
            uint256 amountOut,
            uint256 feeAmount
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
        uint256 notional;

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
            // variable taker
            notional = amountOut;
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

            // fixed taker
            notional = amountIn;
        }

        // cap the output amount to not exceed the remaining output amount
        if (!exactIn && amountOut > uint256(-amountRemaining)) {
            /// @dev if !exact in => fixedTaker => has no effect on notional since notional = amountIn
            amountOut = uint256(-amountRemaining);
        }

        uint256 notionalWad = PRBMathUD60x18.fromUint(notional);
        
        feeAmount = computeFeeAmount(
            notionalWad,
            timeToMaturityInSecondsWad,
            feePercentageWad
        );
    }
}
