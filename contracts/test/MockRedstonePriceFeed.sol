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

    function decimals() external pure override returns (uint8) {
        return 8;
    }

    function pushRate(int256 rate) public {
        _rate[rightIndex] = rate;
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
    }

    function canAdvanceIndex() public view returns (bool) {
        return leftIndex + 1 < rightIndex;
    }

    function advanceIndex() public {
        leftIndex += 1;
    }
}
