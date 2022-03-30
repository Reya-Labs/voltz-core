// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../compound/ICToken.sol";
import "../IERC20Minimal.sol";

interface ICompoundFCM {

    // function ctoken() external returns (ICToken);

    function underlyingYieldBearingToken() external returns (IERC20Minimal);
}
