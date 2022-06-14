// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

interface IStETH {

    function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);
}