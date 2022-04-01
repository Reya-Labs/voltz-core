// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../core_libraries/Time.sol";

contract TimeTest {
    function blockTimestampScaled() public view returns (uint256) {
        return Time.blockTimestampScaled();
    }
}
