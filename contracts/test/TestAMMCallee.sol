pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IAMM.sol";

contract TestAMMCallee {
    using SafeCast for uint256;


        // address recipient,
        // bool isFT, // equivalent to zeroForOne
        // int256 amountSpecified,
        // uint160 sqrtPriceLimitX96,


  function swapExact0For1(
        address amm,
        uint256 amount0In,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IAMM(amm).swap(recipient, true, amount0In.toInt256(), sqrtPriceLimitX96, abi.encode(msg.sender));
  }

  function swap0ForExact1(
        address amm,
        uint256 amount1Out,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IAMM(amm).swap(recipient, true, -amount1Out.toInt256(), sqrtPriceLimitX96, abi.encode(msg.sender));
  }


  function swapExact1For0(
        address amm,
        uint256 amount1In,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IAMM(amm).swap(recipient, false, amount1In.toInt256(), sqrtPriceLimitX96, abi.encode(msg.sender));
  }

  
  function swap1ForExact0(
        address amm,
        uint256 amount0Out,
        address recipient,
        uint160 sqrtPriceLimitX96
    ) external {
        IAMM(amm).swap(recipient, false, -amount0Out.toInt256(), sqrtPriceLimitX96, abi.encode(msg.sender));
  }


  function swapToLowerSqrtPrice(
        address amm,
        uint160 sqrtPriceX96,
        address recipient
    ) external {
        IAMM(amm).swap(recipient, true, type(int256).max, sqrtPriceX96, abi.encode(msg.sender));
  }

  
  function swapToHigherSqrtPrice(
        address amm,
        uint160 sqrtPriceX96,
        address recipient
    ) external {
        IAMM(amm).swap(recipient, false, type(int256).max, sqrtPriceX96, abi.encode(msg.sender));
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
