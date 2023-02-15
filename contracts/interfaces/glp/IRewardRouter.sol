// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

interface IRewardRouter {
    function feeGlpTracker() external view returns (address);
    function glpManager() external view returns (address);
}