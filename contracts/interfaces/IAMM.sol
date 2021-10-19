pragma solidity ^0.8.0;

import "./amm/IAMMImmutables.sol";
import "./amm/IAMMState.sol";
import "./amm/IAMMActions.sol";
// import "./amm/IAMMOwnerActions.sol";
import "./amm/IAMMEvents.sol";



/// @title The interface for a AMM
/// @notice A Voltz amm
/// @dev The pool interface is broken up into many smaller pieces
interface IAMM is
    IAMMImmutables,
    IAMMState,
    IAmmActions,
    IAMMEvents
{

}