// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;
import "../../aave/AaveDataTypes.sol";

interface IAaveV2LendingPool {

    function getReserveNormalizedIncome(address underlyingAsset) external view returns (uint256);

    function getReserveData(address asset) external view returns (AaveDataTypes.ReserveData memory);

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);


}
