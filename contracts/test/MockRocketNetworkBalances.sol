// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/interfaces/rocketPool/IRocketNetworkBalances.sol";
import "contracts/test/MockRocketEth.sol";

/**
 * @dev RocketNetworkBalances mock - only for testing purposes.
 */
contract MockRocketNetworkBalances is IRocketNetworkBalances {
    MockRocketEth public _mockRocketEth;

    constructor(MockRocketEth mockRocketEth) {
        _mockRocketEth = mockRocketEth;
    }

    function getBalancesBlock() external view override returns (uint256) {
        return _mockRocketEth.getLastUpdatedBlock();
    }
}
