// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "./InterestRateModel.sol";

// Subset of https://github.com/compound-finance/compound-protocol/blob/master/contracts/CTokenInterfaces.sol
contract CTokenStorage {

    // Maximum borrow rate that can ever be applied (.0005% / block)
    uint internal constant borrowRateMaxMantissa = 0.0005e16;

    /**
     * @notice Model which tells what the current interest rate should be
     */
    InterestRateModel public interestRateModel;

    /**
     * @notice Block number that interest was last accrued at
     */
    uint public accrualBlockNumber;

    /**
     * @notice Accumulator of the total earned interest rate since the opening of the market
     */
    uint public borrowIndex;

    /**
     * @notice Total amount of outstanding borrows of the underlying in this market
     */
    uint public totalBorrows;

    /**
     * @notice Total amount of reserves of the underlying held in this market
     */
    uint public totalReserves;
}


abstract contract ICToken is CTokenStorage {

    /**
     * @notice Calculates the exchange rate from the underlying to the CToken
     * @dev This function does not accrue interest before calculating the exchange rate
     * @return Calculated exchange rate, scaled by 1 * 10^(18 - 8 + Underlying Token Decimals)
     */
  function exchangeRateStored() virtual external view returns (uint256);

    /**
     * @notice Accrue interest then return the up-to-date exchange rate
     * @return Calculated exchange rate, scaled by 1 * 10^(18 - 8 + Underlying Token Decimals)
     */
  function exchangeRateCurrent() virtual external returns (uint256);

  function redeemUnderlying(uint redeemAmount) virtual external returns (uint);

  /*** User Interface ***/

  function getCash() virtual external view returns (uint);

      /**
     * @notice Underlying asset for this CToken
     */
  function underlying() virtual external view returns (address);

  function supplyRatePerBlock() virtual external view returns (uint256);
}