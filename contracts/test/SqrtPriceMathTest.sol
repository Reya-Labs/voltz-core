// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../utils/SqrtPriceMath.sol";

contract SqrtPriceMathTest {
    function getAmount0Delta(
        uint160 sqrtLower,
        uint160 sqrtUpper,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256 amount0) {
        return
            SqrtPriceMath.getAmount0Delta(
                sqrtLower,
                sqrtUpper,
                liquidity,
                roundUp
            );
    }

    function getAmount1Delta(
        uint160 sqrtLower,
        uint160 sqrtUpper,
        uint128 liquidity,
        bool roundUp
    ) external pure returns (uint256 amount1) {
        return
            SqrtPriceMath.getAmount1Delta(
                sqrtLower,
                sqrtUpper,
                liquidity,
                roundUp
            );
    }
}
