// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma abicoder v2;
import "../../aave/AaveDataTypes.sol";
import "../IERC20Minimal.sol";

interface IAaveV2LendingPool {


    function getReserveNormalizedIncome(IERC20Minimal underlyingAsset) external view returns (uint256);

    function initReserve(
        IERC20Minimal asset,
        address aTokenAddress
    ) external;

    function getReserveData(IERC20Minimal asset) external view returns (AaveDataTypes.ReserveData memory);

    function withdraw(
        IERC20Minimal asset,
        uint256 amount,
        address to
    ) external returns (uint256);


}
