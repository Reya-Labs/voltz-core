// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs
interface IFactory {
    function createVAMM(bytes32 salt) external;

    function createMarginEngine(bytes32 salt) external;

    function getVAMMAddress(bytes32 salt) external view returns (address);

    function getMarginEngineAddress(bytes32 salt)
        external
        view
        returns (address);

    function masterVAMM() external view returns (address);

    function masterMarginEngine() external view returns (address);
}
