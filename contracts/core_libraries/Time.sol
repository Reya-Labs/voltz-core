// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library Time {
    uint256 private constant MAX_UINT32 = 2**32 - 1;

    /// @notice Calculate block.timestamp to wei precision
    /// @return Current timestamp in wei-seconds (1/1e18)
    function blockTimestampScaled() internal view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return block.timestamp * 10**18;
    }

    /// @dev Returns the block timestamp truncated to 32 bits, checking for overflow.
    function blockTimestampTruncated() internal view returns (uint32) {
        return timestampAsUint32(block.timestamp);
    }

    function timestampAsUint32(uint256 _timestamp)
        internal
        pure
        returns (uint32 timestamp)
    {
        require(_timestamp <= MAX_UINT32, "TSOFLOW");
        return uint32(_timestamp);
    }
}
