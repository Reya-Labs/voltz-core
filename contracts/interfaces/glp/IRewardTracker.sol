// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

interface IRewardTracker {
    function tokensPerInterval() external view returns (uint256);
    function rewardToken() external view returns (address);
}