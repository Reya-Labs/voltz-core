// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/IAMM.sol";
import "../interfaces/IVAMM.sol";
import "../utils/TickMath.sol";
import "../core_libraries/Position.sol";
import "../core_libraries/Tick.sol";

/// @title Utilities for unwinding traders (fixed / variable takers) and positions (LPs)
/// @author Artur Begyan
library UnwindTraderUnwindPosition {
  using Position for mapping(bytes32 => Position.Info);
  using Position for Position.Info;

  /// @notice Unwind a trader in a given market
  /// @param ammAddress The address of the IAMM contract to unwind (note: this is different from the corresponding vAMM)
  /// @param traderAddress The address of the trader to unwind
  /// @param notional The number of tokens to unwind (the opposite of the trade, so positive – variable tokens – for fixed takers, and negative – fixed tokens - for variable takers, such that fixed tokens + variable tokens = 0)
  function unwindTrader(
    address ammAddress,
    address traderAddress,
    int256 notional
  ) external {
    IAMM amm = IAMM(ammAddress);

    bool isFT = notional > 0;

    if (isFT) {
      // get into a VT swap
      // notional is positive
      IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: traderAddress,
        isFT: !isFT,
        amountSpecified: -notional,
        sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
        isUnwind: true,
        isTrader: true
      });

      amm.swap(params);
    } else {
      // get into an FT swap
      // notional is negative

      IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: traderAddress,
        isFT: isFT,
        amountSpecified: notional,
        sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
        isUnwind: true,
        isTrader: true
      });

      amm.swap(params);
    }
  }

  /// @notice Unwind an LP position for a given tick range
  /// @param ammAddress The address of the IAMM contract to unwind (note: this is different from the corresponding vAMM)
  /// @param owner The address of the LP to unwind
  /// @param tickLower The lower bound of the tick range, inclusive
  /// @param tickUpper The upper bound of the tick range, inclusive
  /// @param position The corresponding Position.Info struct that represents the position
  /// @return _fixedTokenBalance The remaining fixed token balance
  /// @return _variableTokenBalance The remaining variable token balance
  function unwindPosition(
    address ammAddress,
    address owner,
    int24 tickLower,
    int24 tickUpper,
    Position.Info memory position
  ) external returns (int256 _fixedTokenBalance, int256 _variableTokenBalance) {
    IAMM amm = IAMM(ammAddress);
    Tick.checkTicks(tickLower, tickUpper);

    require(
      position.variableTokenBalance != 0,
      "no need to unwind a net zero position"
    );

    // initiate a swap
    bool isFT = position.fixedTokenBalance > 0;

    if (isFT) {
      // get into a VT swap
      // variableTokenBalance is negative

      IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: owner,
        isFT: !isFT,
        amountSpecified: position.variableTokenBalance, // check the sign
        sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
        isUnwind: true,
        isTrader: false
      });

      (_fixedTokenBalance, _variableTokenBalance) = amm.swap(params); // check the outputs are correct
    } else {
      // get into an FT swap
      // variableTokenBalance is positive

      IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: owner,
        isFT: isFT,
        amountSpecified: position.variableTokenBalance,
        sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
        isUnwind: true,
        isTrader: false
      });

      (_fixedTokenBalance, _variableTokenBalance) = amm.swap(params);
    }
  }
}
