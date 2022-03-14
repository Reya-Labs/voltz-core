// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../compound/ICToken.sol";
import "../rate_oracles/IRateOracle.sol";

interface ICompoundRateOracle is IRateOracle {

    /// @notice Gets the address of the cToken
    /// @return Address of the cToken
    function ctoken() external view returns (address);

    /// @notice Gets the number of decimals of the underlying
    /// @return Number of decimals of the underlying
    function decimals() external view returns (uint);

}