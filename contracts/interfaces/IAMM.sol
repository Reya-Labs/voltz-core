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

    // tick related logic (feels like it shouldn't be here)
    // // todo: place into one of the above interfaces
    // function flipTicks(
    //     IVAMM.ModifyPositionParams memory params, 
    //     uint256 _feeGrowthGlobal, 
    //     int24 currentTick, 
    //     int256 fixedTokenGrowthGlobal, 
    //     int256 variableTokenGrowthGlobal,  
    //     uint128 maxLiquidityPerTick, 
    //     int24 tickSpacing
    //     ) external returns(bool flippedLower, bool flippedUpper);
    
    // function clearTicks(int24 tick) external;

    // function crossTicks(
    //     int24 tick,
    //     int256 fixedTokenGrowthGlobal,
    //     int256 variableTokenGrowthGlobal,
    //     uint256 feeGrowthGlobal
    // ) external;


}
