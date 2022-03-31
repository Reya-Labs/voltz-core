// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;



interface ICToken {

  /// audit: add natspec to interface and function
  /// audit: add a link to the ICToken implementation by compound

  function exchangeRateStored() external view returns (uint256);
}