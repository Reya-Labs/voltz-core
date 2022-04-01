// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../utils/TickMath.sol";

contract TickMathTest {
    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160) {
        return TickMath.getSqrtRatioAtTick(tick);
    }

    function getGasCostOfGetSqrtRatioAtTick(int24 tick)
        external
        view
        returns (uint256)
    {
        uint256 gasBefore = gasleft();
        TickMath.getSqrtRatioAtTick(tick);
        return gasBefore - gasleft();
    }

    function getTickAtSqrtRatio(uint160 sqrtPriceX96)
        external
        pure
        returns (int24)
    {
        return TickMath.getTickAtSqrtRatio(sqrtPriceX96);
    }

    function getGasCostOfGetTickAtSqrtRatio(uint160 sqrtPriceX96)
        external
        view
        returns (uint256)
    {
        uint256 gasBefore = gasleft();
        TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        return gasBefore - gasleft();
    }

    // solhint-disable-next-line func-name-mixedcase
    function MIN_SQRT_RATIO() external pure returns (uint160) {
        return TickMath.MIN_SQRT_RATIO;
    }

    // solhint-disable-next-line func-name-mixedcase
    function MAX_SQRT_RATIO() external pure returns (uint160) {
        return TickMath.MAX_SQRT_RATIO;
    }
}
