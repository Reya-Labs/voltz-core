// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/// @title An interface for a contract that is capable of deploying Voltz AMMs
/// @notice A contract that constructs an AMM must implement this to pass arguments to the pool
/// @dev This is used to avoid having constructor arguments in the pool contract, which results in the init code hash
/// of the pool being constant allowing the CREATE2 address of the pool to be cheaply computed on-chain
interface IDeployer {
    function vammParameters() external view returns (address ammAddress);

    function marginEngineParameters()
        external
        view
        returns (address ammAddress);

    /// @notice Get the parameters to be used in constructing the pool, set transiently during pool creation.
    /// @dev Called by the pool constructor to fetch the parameters of the pool
    /// Returns factory The factory address
    /// Returns underlyingToken Address of the underlying token
    /// Returns underlyingPool Address of the underlying pool
    /// Returns termEndTimestamp number of days from inception of the pool till maturity
    /// Returns termStartTimestamp Datetime of pool's inception
    function ammParameters()
        external
        view
        returns (
            address factory,
            address underlyingToken,
            bytes32 rateOracleId,
            uint256 termStartTimestamp,
            uint256 termEndTimestamp
        );
}
