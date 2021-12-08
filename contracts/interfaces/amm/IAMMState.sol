// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../IVAMM.sol";
import "../IMarginEngine.sol";
import "../../core_libraries/Tick.sol";

/// @title AMM state that can change
/// @notice These methods compose the amm's state, and can change with any frequency including multiple times
/// per transaction
interface IAMMState {

  function getSlot0() external view;

  function getVariableTokenGrowthGlobal() external view;

  function getFixedTokenGrowthGlobal() external view;

  function getVariableTokenGrowthInside(Tick.VariableTokenGrowthInsideParams memory params) external view;

  function getFixedTokenGrowthInside(Tick.FixedTokenGrowthInsideParams memory params) external view;

  function getFeeGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        uint256 feeGrowthGlobal
  ) external view;
 
  /// @notice Look up information about a specific tick in the amm
  /// @param tick The tick to look up
  /// @return liquidityGross the total amount of position liquidity that uses the amm either as tick lower or
  /// tick upper,
  /// liquidityNet how much liquidity changes when the amm price crosses the tick,
  /// feeGrowthOutsideX128 the fee growth on the other side of the tick from the current tick in underlying Token
  /// i.e. if liquidityGross is greater than 0. In addition, these values are only relative and are used to
  /// compute snapshots.
  function ticks(int24 tick)
    external
    view
    returns (
      uint128 liquidityGross,
      int128 liquidityNet,
      int256 fixedTokenGrowthOutside,
      int256 variableTokenGrowthOutside,
      uint256 feeGrowthOutside,
      bool initialized
    );

  /// @notice Returns 256 packed tick initialized boolean values. See TickBitmap for more information
  function tickBitmap(int16 wordPosition) external view returns (uint256);

  /// @notice Returns the information about a position by the position's key
  /// @param key The position's key is a hash of a preimage composed by the owner, tickLower and tickUpper
  function positions(bytes32 key)
    external
    view
    returns (
      uint128 _liquidity,
      int256 margin,
      int256 fixedTokenGrowthInsideLast,
      int256 variableTokenGrowthInsideLast,
      int256 fixedTokenBalance,
      int256 variableTokenBalance,
      uint256 feeGrowthInsideLast
    );

  /// @notice Returns the information about a trader by the trader key
  /// @param key The trader's key is a hash of a preimage composed by the owner, notional, fixedRate
  function traders(bytes32 key)
    external
    view
    returns (
      int256 margin,
      int256 fixedTokenBalance,
      int256 variableTokenBalance,
      bool settled
    );


    function vamm() external view returns (IVAMM);
    function marginEngine() external returns (IMarginEngine);
    function unlocked() external returns (bool);


}
