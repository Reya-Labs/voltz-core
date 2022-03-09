// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../compound/ICToken.sol";
import "../rate_oracles/IRateOracle.sol";

interface ICompoundRateOracle is IRateOracle {

    /// @notice Gets the address of the Aave Lending Pool
    /// @return Address of the Aave Lending Pool
    function ctoken() external view returns (address);

}