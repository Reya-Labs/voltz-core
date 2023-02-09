// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

interface IVault {
    function getMinPrice(address _token) external view returns (uint256);
}