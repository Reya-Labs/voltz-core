// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/TokenMath.sol";

contract TokenMathTest {
  function toBase(uint256 _value, uint8 _decimals)
    external
    pure
    returns (uint256)
  {
    return TokenMath.toBase(_value, _decimals);
  }

  function toAmount(uint256 _value, uint8 _decimals)
    external
    pure
    returns (uint256)
  {
    return TokenMath.toAmount(_value, _decimals);
  }

  function toBaseFromWei(uint256 _baseValue, uint8 _decimals)
    external
    pure
    returns (uint256)
  {
    return TokenMath.toBaseFromWei(_baseValue, _decimals);
  }
}
