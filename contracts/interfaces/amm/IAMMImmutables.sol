// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../IMarginCalculator.sol";
import "../rate_oracles/IRateOracle.sol";

/// @title Pool state that never changes
/// @notice These parameters are fixed for a amm forever, i.e., the methods will always return the same values
interface IAMMImmutables {

    /// @notice The contract that deployed the amm, which must adhere to the Factory interface
    /// @return The contract address
    function factory() external view returns (address);

    // /// @notice The address of the underlying (non-yield bearing) pool token - e.g. USDC
    // /// @return The underlying pool token address
    function underlyingToken() external view returns (address);

    function rateOracleAddress() external view returns (address);

    function termStartTimestamp() external view returns (uint256);
    function termEndTimestamp() external view returns (uint256);

    function calculator() external view returns (IMarginCalculator);

    function rateOracle() external view returns (IRateOracle);

}
