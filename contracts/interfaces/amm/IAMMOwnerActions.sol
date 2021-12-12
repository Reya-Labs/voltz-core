// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title Permissioned amm actions
/// @notice Contains amm methods that may only be called by the factory owner
interface IAMMOwnerActions {
  /// @notice Set the proportion of LP fees used as protocols fees
  /// @param feeProtocol  new protocol fee
  function setFeeProtocol(uint256 feeProtocol) external;

  function collectProtocol(address recipient) external returns (uint256 amount);
}
