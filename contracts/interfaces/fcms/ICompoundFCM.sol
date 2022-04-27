// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../compound/ICToken.sol";
import "../IERC20Minimal.sol";

interface ICompoundFCM {

    /// The CToken
    function cToken() external returns (ICToken);
}
