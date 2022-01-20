// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathUD60x18.sol";

library Time {
    uint256 private constant MAX_UINT32 = 2**32 - 1;
    uint256 public constant SECONDS_IN_DAY_WAD = 86400 * 10**18; /// convert into WAD via PRB

    /// @notice Calculate block.timestamp to wei precision
    /// @return Current timestamp in wei-seconds (1/1e18)
    function blockTimestampScaled() internal view returns (uint256) {
        // solhint-disable-next-line not-rely-on-time
        return PRBMathUD60x18.fromUint(block.timestamp);
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

    function isCloseToMaturityOrBeyondMaturity(uint256 termEndTimestampWad)
        internal
        view
        returns (bool vammInactive)
    {
        uint256 currentTimestamp = Time.blockTimestampScaled();

        if (currentTimestamp >= termEndTimestampWad) {
            vammInactive = true;
        } else {
            uint256 timeDelta = termEndTimestampWad - currentTimestamp;
            if (timeDelta <= SECONDS_IN_DAY_WAD) {
                vammInactive = true;
            }
        }
    }
}
