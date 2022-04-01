// SPDX-License-Identifier: agpl-3.0

pragma solidity =0.8.9;
pragma abicoder v2;
import "../../aave/AaveDataTypes.sol";
import "../IERC20Minimal.sol";

interface IAaveV2LendingPool {

    /**
    * @dev Returns the normalized income normalized income of the reserve
    * @dev A return value of 1e27 indicates no income. As time passes, the income is accrued. A value of 2e27 indicates that for each unit of asset, two units of income have been accrued.
    * @param underlyingAsset The address of the underlying asset of the reserve
    * @return The reserve's normalized income
    */
    function getReserveNormalizedIncome(IERC20Minimal underlyingAsset) external view returns (uint256);


    /**
    * @dev Returns the state and configuration of the reserve
    * @param asset The address of the underlying asset of the reserve
    * @return The state of the reserve
    **/
    function getReserveData(IERC20Minimal asset) external view returns (AaveDataTypes.ReserveData memory);

    /**
    * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
    * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
    * @param asset The address of the underlying asset to withdraw
    * @param amount The underlying amount to be withdrawn
    *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
    * @param to Address that will receive the underlying, same as msg.sender if the user
    *   wants to receive it on his own wallet, or a different address if the beneficiary is a
    *   different wallet
    * @return The final amount withdrawn
    **/
    function withdraw(
        IERC20Minimal asset,
        uint256 amount,
        address to
    ) external returns (uint256);


}
