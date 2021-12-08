
// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../AMM.sol";
import "../core_libraries/Position.sol";

// used for testing time dependent behavior
contract MockTimeAMM is AMM {
    // Monday, October 5, 2020 9:00:00 AM GMT-05:00
    uint256 public time = 1601906400;

    function advanceTime(uint256 by) external {
        time += by;
    }
}
