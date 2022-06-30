// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/interfaces/lido/ILidoOracle.sol";

/**
 * @dev Lido Oracle mock - only for testing purposes.
 */
contract MockLidoOracle is ILidoOracle {
    uint256 private sharesMultiplier = 1e27;

    /**
     * @notice Report beacon balance and its change during the last frame
     */
    function getLastCompletedReportDelta()
        external
        view
        override
        returns (
            uint256 postTotalPooledEther,
            uint256 preTotalPooledEther,
            uint256 timeElapsed
        )
    {
        return ((sharesMultiplier * 101) / 100, sharesMultiplier, 86400);
    }

    /**
     * @notice Return currently reportable epoch (the first epoch of the current frame) as well as
     * its start and end times in seconds
     */
    function getCurrentFrame()
        external
        view
        override
        returns (
            uint256 frameEpochId,
            uint256 frameStartTime,
            uint256 frameEndTime
        )
    {
        // solhint-disable-next-line not-rely-on-time
        return (0, block.timestamp - 43200, block.timestamp + 43200);
    }

    /**
     * @notice Returns staking rewards fee rate
     */
    function getFee() external view override returns (uint16 feeBasisPoints) {
        return 1000;
    }
}
