// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "./IVault.sol";

interface IGlpManager {
    function getAum(bool maximise) external view returns (uint256);
    function vault() external view returns (IVault);
    function glp() external view returns (address);
}