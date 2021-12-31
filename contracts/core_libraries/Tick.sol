// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/LowGasSafeMath.sol";
import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../utils/LiquidityMath.sol";
import "hardhat/console.sol";

/// @title Tick
/// @notice Contains functions for managing tick processes and relevant calculations
library Tick {
    using LowGasSafeMath for int256;
    using SafeCast for int256;

    // info stored for each initialized individual tick
    struct Info {
        // the total position liquidity that references this tick
        uint128 liquidityGross;
        // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left),
        int128 liquidityNet;
        // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
        // only has relative meaning, not absolute — the value depends on when the tick is initialized

        int256 fixedTokenGrowthOutside;
        int256 variableTokenGrowthOutside;
        uint256 feeGrowthOutside;
        bool initialized;
    }

    /// @dev Common checks for valid tick inputs.
    function checkTicks(int24 tickLower, int24 tickUpper) internal pure {
        require(tickLower < tickUpper, "TLU");
        require(tickLower >= TickMath.MIN_TICK, "TLM");
        require(tickUpper <= TickMath.MAX_TICK, "TUM");
    }

    function getFeeGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        uint256 feeGrowthGlobal
    ) external view returns (uint256 feeGrowthInside) {
        Info storage lower = self[tickLower];
        Info storage upper = self[tickUpper];

        // calculate fee growth below
        uint256 feeGrowthBelow;

        if (tickCurrent >= tickLower) {
            feeGrowthBelow = lower.feeGrowthOutside;
        } else {
            feeGrowthBelow = feeGrowthGlobal - lower.feeGrowthOutside;
        }

        // calculate fee growth above
        uint256 feeGrowthAbove;

        if (tickCurrent < tickUpper) {
            feeGrowthAbove = upper.feeGrowthOutside;
        } else {
            feeGrowthAbove = feeGrowthGlobal - upper.feeGrowthOutside;
        }

        feeGrowthInside = feeGrowthGlobal - (feeGrowthBelow + feeGrowthAbove);
    }

    /// @notice Derives max liquidity per tick from given tick spacing
    /// @dev Executed within the pool constructor
    /// @param tickSpacing The amount of required tick separation, realized in multiples of `tickSpacing`
    ///     e.g., a tickSpacing of 3 requires ticks to be initialized every 3rd tick i.e., ..., -6, -3, 0, 3, 6, ...
    /// @return The max liquidity per tick
    // AB: don't need this 
    // function tickSpacingToMaxLiquidityPerTick(int24 tickSpacing)
    //     internal
    //     pure
    //     returns (uint128)
    // {
    //     int24 minTick = (TickMath.MIN_TICK / tickSpacing) * tickSpacing;
    //     int24 maxTick = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
    //     uint24 numTicks = uint24((maxTick - minTick) / tickSpacing) + 1;
    //     return type(uint128).max / numTicks;
    // }

    struct VariableTokenGrowthInsideParams {
        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int256 variableTokenGrowthGlobal;
    }

    function getVariableTokenGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        VariableTokenGrowthInsideParams memory params
    ) public view returns (int256 variableTokenGrowthInside) {
        Info storage lower = self[params.tickLower];
        Info storage upper = self[params.tickUpper];

        // calculate the VariableTokenGrowth below
        int256 variableTokenGrowthBelow;

        if (params.tickCurrent >= params.tickLower) {
            variableTokenGrowthBelow = lower.variableTokenGrowthOutside;
        } else {
            variableTokenGrowthBelow =
                params.variableTokenGrowthGlobal -
                lower.variableTokenGrowthOutside;
        }

        // calculate the VariableTokenGrowth above
        int256 variableTokenGrowthAbove;

        if (params.tickCurrent < params.tickUpper) {
            variableTokenGrowthAbove = upper.variableTokenGrowthOutside;
        } else {
            variableTokenGrowthAbove =
                params.variableTokenGrowthGlobal -
                upper.variableTokenGrowthOutside;
        }

        variableTokenGrowthInside =
            params.variableTokenGrowthGlobal -
            (variableTokenGrowthBelow + variableTokenGrowthAbove);
    }

    struct FixedTokenGrowthInsideParams {
        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int256 fixedTokenGrowthGlobal;
    }

    function getFixedTokenGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        FixedTokenGrowthInsideParams memory params
    ) public view returns (int256 fixedTokenGrowthInside) {
        Info storage lower = self[params.tickLower];
        Info storage upper = self[params.tickUpper];

        // calculate the FixedTokenGrowth below
        int256 fixedTokenGrowthBelow;

        if (params.tickCurrent >= params.tickLower) {
            fixedTokenGrowthBelow = lower.fixedTokenGrowthOutside;
        } else {
            fixedTokenGrowthBelow =
                params.fixedTokenGrowthGlobal -
                lower.fixedTokenGrowthOutside;
        }

        // calculate the FixedTokenGrowth above
        int256 fixedTokenGrowthAbove;

        if (params.tickCurrent < params.tickUpper) {
            fixedTokenGrowthAbove = upper.fixedTokenGrowthOutside;
        } else {
            fixedTokenGrowthAbove =
                params.fixedTokenGrowthGlobal -
                upper.fixedTokenGrowthOutside;
        }

        fixedTokenGrowthInside =
            params.fixedTokenGrowthGlobal -
            (fixedTokenGrowthBelow + fixedTokenGrowthAbove);
    }

    /// @notice Updates a tick and returns true if the tick was flipped from initialized to uninitialized, or vice versa
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The tick that will be updated
    /// @param tickCurrent The current tick
    /// @param liquidityDelta A new amount of liquidity to be added (subtracted) when tick is crossed from left to right (right to left)
    /// @param upper true for updating a position's upper tick, or false for updating a position's lower tick
    /// @param maxLiquidity The maximum liquidity allocation for a single tick
    /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
    function update(
        mapping(int24 => Tick.Info) storage self,
        int24 tick,
        int24 tickCurrent,
        int128 liquidityDelta,
        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,
        uint256 feeGrowthGlobal,
        bool upper,
        uint128 maxLiquidity
    ) external returns (bool flipped) {
        // update is no longer internal

        Tick.Info storage info = self[tick];

        uint128 liquidityGrossBefore = info.liquidityGross;
        uint128 liquidityGrossAfter = LiquidityMath.addDelta(
            liquidityGrossBefore,
            liquidityDelta
        );

        require(liquidityGrossAfter <= maxLiquidity, "LO");

        flipped = (liquidityGrossAfter == 0) != (liquidityGrossBefore == 0);

        if (liquidityGrossBefore == 0) {
            // by convention, we assume that all growth before a tick was initialized happened _below_ the tick
            if (tick <= tickCurrent) {
                info.feeGrowthOutside = feeGrowthGlobal;

                info.fixedTokenGrowthOutside = fixedTokenGrowthGlobal;

                info.variableTokenGrowthOutside = variableTokenGrowthGlobal;
            }

            info.initialized = true;
        }

        info.liquidityGross = liquidityGrossAfter;

        // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
        info.liquidityNet = upper
            ? int256(info.liquidityNet).sub(liquidityDelta).toInt128()
            : int256(info.liquidityNet).add(liquidityDelta).toInt128();
    }

    /// @notice Clears tick data
    /// @param self The mapping containing all initialized tick information for initialized ticks
    /// @param tick The tick that will be cleared
    function clear(mapping(int24 => Tick.Info) storage self, int24 tick)
        external
    {
        delete self[tick];
    }

    /// @notice Transitions to next tick as needed by price movement
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The destination tick of the transition
    /// @return liquidityNet The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
    function cross(
        mapping(int24 => Tick.Info) storage self,
        int24 tick,
        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,
        uint256 feeGrowthGlobal
    ) external returns (int128 liquidityNet) {
        Tick.Info storage info = self[tick];

        info.feeGrowthOutside = feeGrowthGlobal - info.feeGrowthOutside;

        info.fixedTokenGrowthOutside =
            fixedTokenGrowthGlobal -
            info.fixedTokenGrowthOutside;

        info.variableTokenGrowthOutside =
            variableTokenGrowthGlobal -
            info.variableTokenGrowthOutside;

        liquidityNet = info.liquidityNet;
    }
}
