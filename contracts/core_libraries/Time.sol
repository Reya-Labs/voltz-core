// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Time {
  /// @notice Calculate block.timestamp to wei precision
  /// @return Current timestamp in wei-seconds (1/1e18)
  function blockTimestampScaled() public view returns (uint256) {
    return block.timestamp * 10**18;
  }
}
