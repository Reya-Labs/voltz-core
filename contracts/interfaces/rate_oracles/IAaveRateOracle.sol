// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../aave/IAaveV2LendingPool.sol";
import "../rate_oracles/IRateOracle.sol";

interface IAaveRateOracle is IRateOracle {

    /// @notice Gets the address of the Aave Lending Pool
    /// @return Address of the Aave Lending Pool
    function aaveLendingPool() external view returns (address);

}
