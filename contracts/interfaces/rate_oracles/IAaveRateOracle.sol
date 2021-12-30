// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../aave/IAaveV2LendingPool.sol";
import "../rate_oracles/IRateOracle.sol";

interface IAaveRateOracle is IRateOracle {

    function aaveLendingPool() external view returns (address);

    function getReserveNormalizedIncome(address underlying) external view returns(uint256);

}
