// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../IVAMM.sol";
import "../IMarginEngine.sol";
import "../../core_libraries/Tick.sol";

/// @title AMM state that can change
/// @notice These methods compose the amm's state, and can change with any frequency including multiple times
/// per transaction
interface IAMMState {

  function getSlot0() external view returns (IVAMM.Slot0 memory);

  function getVariableTokenGrowthGlobal() external view returns(int256);

  function getFixedTokenGrowthGlobal() external view returns(int256);

  // function getVariableTokenGrowthInside(Tick.VariableTokenGrowthInsideParams memory params) external view returns(int256);

  // function getFixedTokenGrowthInside(Tick.FixedTokenGrowthInsideParams memory params) external view returns(int256);

  // function getFeeGrowthInside(
  //       int24 tickLower,
  //       int24 tickUpper,
  //       int24 tickCurrent,
  //       uint256 feeGrowthGlobal
  // ) external view returns(uint256);
  

    function vamm() external view returns (IVAMM);
    function marginEngine() external returns (IMarginEngine);
    function unlocked() external returns (bool);


}
