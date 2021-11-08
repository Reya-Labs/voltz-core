pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IAMM.sol";
import "../AMM.sol";

contract TestAMMCallee is AMM {
    using SafeCast for uint256;

  function swapExact0For1(
        address amm,
        uint256 amount0In,
        address recipient,
        uint160 sqrtPriceLimitX96,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: true,
               amountSpecified: amount0In.toInt256(),
               sqrtPriceLimitX96: sqrtPriceLimitX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }

  function swap0ForExact1(
        address amm,
        uint256 amount1Out,
        address recipient,
        uint160 sqrtPriceLimitX96,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: true,
               amountSpecified: -amount1Out.toInt256(),
               sqrtPriceLimitX96: sqrtPriceLimitX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }


  function swapExact1For0(
        address amm,
        uint256 amount1In,
        address recipient,
        uint160 sqrtPriceLimitX96,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: false,
               amountSpecified: amount1In.toInt256(),
               sqrtPriceLimitX96: sqrtPriceLimitX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }

  
  function swap1ForExact0(
        address amm,
        uint256 amount0Out,
        address recipient,
        uint160 sqrtPriceLimitX96,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: false,
               amountSpecified: -amount0Out.toInt256(),
               sqrtPriceLimitX96: sqrtPriceLimitX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }


  function swapToLowerSqrtPrice(
        address amm,
        uint160 sqrtPriceX96,
        address recipient,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: true,
               amountSpecified: type(int256).max,
               sqrtPriceLimitX96: sqrtPriceX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }

  
  function swapToHigherSqrtPrice(
        address amm,
        uint160 sqrtPriceX96,
        address recipient,
        int256 proposedMargin
    ) external {

        SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: false,
               amountSpecified: type(int256).max,
               sqrtPriceLimitX96: sqrtPriceX96,
               isUnwind: false,
               isTrader: true,
               proposedMargin: proposedMargin
        });

        IAMM(amm).swap(params);
  }

    function mint(
        address amm,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IAMM(amm).mint(
            recipient,
            tickLower,
            tickUpper,
            amount,
            abi.encode(msg.sender)
        );
    }




}
