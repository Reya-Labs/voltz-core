// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

/// @title Permissioned amm actions
/// @notice Contains amm methods that may only be called by the factory owner
interface IAMMOwnerActions {
    
    /// @notice Set the proportion of LP fees used as protocols fees
    /// @param feeProtocol  new protocol fee
    function setFeeProtocol(uint256 feeProtocol) external;

    /// @notice Collect the protocol fee accrued to the amm
    /// @param recipient The address to which collected protocol fees should be sent
    /// @param amountRequested The maximum amount of underlying token to send
    /// @return amount The protocol fee collected in underlying token
    function collectProtocol(
        address recipient,
        uint256 amountRequested
    ) external returns (uint256 amount);
}
