// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../core_libraries/SwapMath.sol";

contract SwapMathTest {
    function computeFeeAmount(
        uint256 notional,
        uint256 timeToMaturityInSeconds,
        uint256 feePercentage
    ) external pure returns (uint256) {
        return
            SwapMath.computeFeeAmount(
                notional,
                timeToMaturityInSeconds,
                feePercentage
            );
    }

    function computeSwapStep(
        uint160 sqrtRatioCurrentX96,
        uint160 sqrtRatioTargetX96,
        uint128 liquidity,
        int256 amountRemaining,
        uint256 feePercentage,
        uint256 timeToMaturityInSeconds
    )
        external
        pure
        returns (
            uint160 sqrtQ,
            uint256 amountIn,
            uint256 amountOut,
            uint256 feeAmount
        )
    {
        return
            SwapMath.computeSwapStep(
                SwapMath.SwapStepParams(
                    sqrtRatioCurrentX96,
                    sqrtRatioTargetX96,
                    liquidity,
                    amountRemaining,
                    feePercentage,
                    timeToMaturityInSeconds
                )
            );
    }

    function getGasCostOfComputeSwapStep(
        uint160 sqrtRatioCurrentX96,
        uint160 sqrtRatioTargetX96,
        uint128 liquidity,
        int256 amountRemaining,
        uint256 feePercentage,
        uint256 timeToMaturityInSeconds
    ) external view returns (uint256) {
        uint256 gasBefore = gasleft();
        SwapMath.computeSwapStep(
            SwapMath.SwapStepParams(
                sqrtRatioCurrentX96,
                sqrtRatioTargetX96,
                liquidity,
                amountRemaining,
                feePercentage,
                timeToMaturityInSeconds
            )
        );
        return gasBefore - gasleft();
    }
}
