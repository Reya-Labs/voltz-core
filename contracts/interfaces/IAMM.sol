// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./amm/IAMMImmutables.sol";
import "./amm/IAMMState.sol";
import "./amm/IAMMOwnerActions.sol";
import "./amm/IAMMActions.sol";
import "./IVAMM.sol";

/// @title The interface for a AMM
/// @notice A Voltz amm
/// @dev The pool interface is broken up into many smaller pieces
interface IAMM is IAMMImmutables, IAMMState, IAMMOwnerActions, IAMMActions {

}
