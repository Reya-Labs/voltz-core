// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title Callback for mint
/// @notice Any contract that calls mint must implement this interface
interface IAMMMintCallback {
  /// @notice Called to `msg.sender` after minting liquidity to a position from AMM mint.
  /// @dev In the implementation you must pay the pool tokens owed for the minted liquidity (margin)
  /// The caller of this method must be checked to be a AMM deployed by the canonical AMMFactory.
  /// @param underlyingTokensOwed The amount of token0 due to the pool for the minted liquidity
  /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#mint call
  function ammMintCallback(uint256 underlyingTokensOwed, bytes calldata data)
    external;
}
