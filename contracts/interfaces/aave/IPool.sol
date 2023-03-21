// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.9;
import "../IERC20Minimal.sol";

/**
 * @title IPool
 * @author Aave
 * @notice Defines the basic interface for an Aave Pool.
 */
interface IPool {

  /**
   * @notice Returns the normalized income of the reserve
   * @param asset The address of the underlying asset of the reserve
   * @return The reserve's normalized income
   */
  function getReserveNormalizedIncome(address asset) external view returns (uint256);

  function getReserveNormalizedVariableDebt(IERC20Minimal underlyingAsset) external view returns (uint256);
}