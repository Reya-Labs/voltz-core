// SPDX-License-Identifier: agpl-3.0

pragma solidity =0.8.9;
import "../IERC20Minimal.sol";


interface IAToken {

  /**
   * @dev Mints `amount` aTokens to `user`
   * @param user The address receiving the minted tokens
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   * @return `true` if the the previous balance of the user was 0
   */
  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external returns (bool);

    /**
   * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
   * @param user The owner of the aTokens, getting them burned
   * @param receiverOfUnderlying The address that will receive the underlying
   * @param amount The amount being burned
   * @param index The new liquidity index of the reserve
   **/
  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external;

  /**
  * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
  * updated stored balance divided by the reserve's liquidity index at the moment of the update
  * @param user The user whose balance is calculated
  * @return The scaled balance of the user
  **/
  function scaledBalanceOf(address user) external view returns (uint256);

    /**
   * @dev Returns the scaled balance of the user and the scaled total supply.
   * @param user The address of the user
   * @return The scaled balance of the user
   * @return The scaled balance and the scaled total supply
   **/
  function getScaledUserBalanceAndSupply(address user) external view returns (uint256, uint256);

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return The scaled total supply
   **/
  function scaledTotalSupply() external view returns (uint256);

  /**
  * @dev Returns the address of the underlying asset of this aToken (E.g. WETH for aWETH)
  **/
  function UNDERLYING_ASSET_ADDRESS() external view returns (IERC20Minimal);

}