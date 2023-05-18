// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "../interfaces/redstone/IPriceFeed.sol";

/// @notice This Mock Aave pool can be used in 3 ways
/// - change the rate to a fixed value (`setReserveNormalizedIncome`)
/// - configure the rate to alter over time (`setFactorPerSecondInRay`) for more dynamic testing
contract MockRedstonePriceFeed is IPriceFeed {
    uint256 leftIndex;
    uint256 rightIndex;
    int256[1000] _rate;
    uint256[1000] _startedAt;

    function decimals() external pure override returns (uint8) {
        return 8;
    }

    function pushRate(int256 rate, uint256 startedAt) public {
        _rate[rightIndex] = rate;
        _startedAt[rightIndex] = startedAt;
        rightIndex += 1;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 rate,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        rate = _rate[leftIndex];
        startedAt = _startedAt[leftIndex];
    }

    function advanceIndex() public {
        leftIndex += 1;
    }
}
