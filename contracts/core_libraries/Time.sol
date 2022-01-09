// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Time {
    /// @notice Calculate block.timestamp to wei precision
    /// @return Current timestamp in wei-seconds (1/1e18)
    function blockTimestampScaled() public view returns (uint256) {
        // @audit - this should probably be internal so that it gets inlined?
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp * 10**18;
    }
}
