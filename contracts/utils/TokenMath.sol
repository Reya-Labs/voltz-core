// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./LowGasSafeMath.sol";

/// @title ERC20 token math utils
library TokenMath {
  function toBase(uint256 _amountValue, uint8 _decimals)
    internal
    pure
    returns (uint256)
  {
    return LowGasSafeMath.mul(_amountValue, 10**_decimals);
  }

  function toAmount(uint256 _baseValue, uint8 _decimals)
    internal
    pure
    returns (uint256)
  {
    return _baseValue / 10**_decimals;
  }

  function toBaseFromWei(uint256 _baseValue, uint8 _decimals)
    internal
    pure
    returns (uint256)
  {
    return toBase(toAmount(_baseValue, 18), _decimals);
  }
}
