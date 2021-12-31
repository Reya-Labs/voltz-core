// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IPositionStructs.sol";
import "../VAMM.sol";

contract TestVAMMCallee {
    using SafeCast for uint256;

    
    
    function computePositionFixedAndVariableGrowthInsideTest(
        address vamm,
        int24 tickLower,
        int24 tickUpper,
        int24 currentTick
    ) external view returns (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) {
        
        return IVAMM(vamm).computePositionFixedAndVariableGrowthInside(tickLower, tickUpper, currentTick);

    }
    
    
    function mintTest(
        address vamm,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IVAMM(vamm).mint(recipient, tickLower, tickUpper, amount);
    }

    function swapExact0For1(
        address vamm,
        uint256 amount0In,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: true,
            amountSpecified: amount0In.toInt256(),
            sqrtPriceLimitX96: sqrtPriceLimitX96,
            isUnwind: false,
            isTrader: true
        });

        IAMM(vamm).swap(params);
    }

    function swap0ForExact1(
        address vamm,
        uint256 amount1Out,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: true,
            amountSpecified: -amount1Out.toInt256(),
            sqrtPriceLimitX96: sqrtPriceLimitX96,
            isUnwind: false,
            isTrader: true
        });

        IAMM(vamm).swap(params);
    }

    function swapExact1For0(
        address vamm,
        uint256 amount1In,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: false,
            amountSpecified: amount1In.toInt256(),
            sqrtPriceLimitX96: sqrtPriceLimitX96,
            isUnwind: false,
            isTrader: true
        });

        IAMM(vamm).swap(params);
    }

    function swap1ForExact0(
        address vamm,
        uint256 amount0Out,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: false,
            amountSpecified: -amount0Out.toInt256(),
            sqrtPriceLimitX96: sqrtPriceLimitX96,
            isUnwind: false,
            isTrader: true
        });

        IVAMM(vamm).swap(params);
    }

    function swapToLowerSqrtPrice(
        address vamm,
        uint160 sqrtPriceX96,
        address recipient
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: true,
            amountSpecified: type(int256).max,
            sqrtPriceLimitX96: sqrtPriceX96,
            isUnwind: false,
            isTrader: true
        });

        IAMM(vamm).swap(params);
    }

    function swapToHigherSqrtPrice(
        address vamm,
        uint160 sqrtPriceX96,
        address recipient
    ) external {
        IVAMM.SwapParams memory params = IVAMM.SwapParams({
            recipient: recipient,
            isFT: false,
            amountSpecified: type(int256).max,
            sqrtPriceLimitX96: sqrtPriceX96,
            isUnwind: false,
            isTrader: true
        });

        IAMM(vamm).swap(params);
    }
}
