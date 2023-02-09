// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

interface IRewardTracker {
    function distributor() external view returns (address);
}