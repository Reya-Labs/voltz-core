// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../utils/LiquidityMath.sol";
import "../utils/Printer.sol";

/// @title Tick
/// @notice Contains functions for managing tick processes and relevant calculations
library Tick {
    using SafeCast for int256;

    // info stored for each initialized individual tick
    struct Info {
        // the total position liquidity that references this tick
        uint128 liquidityGross;
        // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left),
        int128 liquidityNet;
        // fee growth per unit of liquidity on the _other_ side of this tick (relative to the current tick)
        // only has relative meaning, not absolute — the value depends on when the tick is initialized
        int256 fixedTokenGrowthOutsideX128;
        int256 variableTokenGrowthOutsideX128;
        uint256 feeGrowthOutsideX128;
        // true iff the tick is initialized, i.e. the value is exactly equivalent to the expression liquidityGross != 0
        // these 8 bits are set to prevent fresh sstores when crossing newly initialized ticks
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
        uint256 feeGrowthGlobalX128
    ) internal view returns (uint256 feeGrowthInsideX128) {
        Info storage lower = self[tickLower];
        Info storage upper = self[tickUpper];

        // calculate fee growth below
        uint256 feeGrowthBelowX128;

        if (tickCurrent >= tickLower) {
            feeGrowthBelowX128 = lower.feeGrowthOutsideX128;
        } else {
            feeGrowthBelowX128 =
                feeGrowthGlobalX128 -
                lower.feeGrowthOutsideX128;
        }

        // calculate fee growth above
        uint256 feeGrowthAboveX128;

        if (tickCurrent < tickUpper) {
            feeGrowthAboveX128 = upper.feeGrowthOutsideX128;
        } else {
            feeGrowthAboveX128 =
                feeGrowthGlobalX128 -
                upper.feeGrowthOutsideX128;
        }

        feeGrowthInsideX128 =
            feeGrowthGlobalX128 -
            feeGrowthBelowX128 -
            feeGrowthAboveX128;
    }

    struct VariableTokenGrowthInsideParams {
        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int256 variableTokenGrowthGlobalX128;
    }

    function getVariableTokenGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        VariableTokenGrowthInsideParams memory params
    ) internal view returns (int256 variableTokenGrowthInsideX128) {
        Info storage lower = self[params.tickLower];
        Info storage upper = self[params.tickUpper];

        Printer.printInt24("tick lower", params.tickLower);
        Printer.printInt24("tick upper", params.tickUpper);
        
        // calculate the VariableTokenGrowth below
        int256 variableTokenGrowthBelowX128;

        if (params.tickCurrent >= params.tickLower) {
            variableTokenGrowthBelowX128 = lower.variableTokenGrowthOutsideX128;
        } else {
            Printer.printInt256("variableTokenGrowthGlobalX128", params.variableTokenGrowthGlobalX128);
            Printer.printInt256("lower.variableTokenGrowthOutsideX128", lower.variableTokenGrowthOutsideX128);
            Printer.printInt256("variableTokenGrowthBelowX128", params.variableTokenGrowthGlobalX128 - lower.variableTokenGrowthOutsideX128);

            variableTokenGrowthBelowX128 =
                params.variableTokenGrowthGlobalX128 -
                lower.variableTokenGrowthOutsideX128;
        }

        // calculate the VariableTokenGrowth above
        int256 variableTokenGrowthAboveX128;

        if (params.tickCurrent < params.tickUpper) {
            variableTokenGrowthAboveX128 = upper.variableTokenGrowthOutsideX128;
        } else {
            variableTokenGrowthAboveX128 =
                params.variableTokenGrowthGlobalX128 -
                upper.variableTokenGrowthOutsideX128;
        }

        Printer.printInt256("variableTokenGrowthAboveX128", variableTokenGrowthAboveX128);
        

        variableTokenGrowthInsideX128 =
            params.variableTokenGrowthGlobalX128 -
            (variableTokenGrowthBelowX128 +
            variableTokenGrowthAboveX128);
        
        Printer.printInt256("variableTokenGrowthInsideX128", variableTokenGrowthInsideX128);
    }

    struct FixedTokenGrowthInsideParams {
        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int256 fixedTokenGrowthGlobalX128;
    }

    function getFixedTokenGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        FixedTokenGrowthInsideParams memory params
    ) internal view returns (int256 fixedTokenGrowthInsideX128) {
        Info storage lower = self[params.tickLower];
        Info storage upper = self[params.tickUpper];

        // calculate the fixedTokenGrowth below
        int256 fixedTokenGrowthBelowX128;

        if (params.tickCurrent >= params.tickLower) {
            fixedTokenGrowthBelowX128 = lower.fixedTokenGrowthOutsideX128;
        } else {
            fixedTokenGrowthBelowX128 =
                params.fixedTokenGrowthGlobalX128 -
                lower.fixedTokenGrowthOutsideX128;
        }

        // calculate the fixedTokenGrowth above
        int256 fixedTokenGrowthAboveX128;

        if (params.tickCurrent < params.tickUpper) {
            fixedTokenGrowthAboveX128 = upper.fixedTokenGrowthOutsideX128;
        } else {
            fixedTokenGrowthAboveX128 =
                params.fixedTokenGrowthGlobalX128 -
                upper.fixedTokenGrowthOutsideX128;
        }

        fixedTokenGrowthInsideX128 =
            params.fixedTokenGrowthGlobalX128 -
            (fixedTokenGrowthBelowX128 +
            fixedTokenGrowthAboveX128);
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
        int256 fixedTokenGrowthGlobalX128,
        int256 variableTokenGrowthGlobalX128,
        uint256 feeGrowthGlobalX128,
        bool upper,
        uint128 maxLiquidity
    ) internal returns (bool flipped) {
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
                info.feeGrowthOutsideX128 = feeGrowthGlobalX128;

                info.fixedTokenGrowthOutsideX128 = fixedTokenGrowthGlobalX128;

                info
                    .variableTokenGrowthOutsideX128 = variableTokenGrowthGlobalX128;
            }

            info.initialized = true;
        }

        /// check shouldn't we unintialize the tick if liquidityGrossAfter = 0?

        info.liquidityGross = liquidityGrossAfter;

        /// add comments
        // when the lower (upper) tick is crossed left to right (right to left), liquidity must be added (removed)
        info.liquidityNet = upper
            ? info.liquidityNet - liquidityDelta
            : info.liquidityNet + liquidityDelta;
    }

    /// @notice Clears tick data
    /// @param self The mapping containing all initialized tick information for initialized ticks
    /// @param tick The tick that will be cleared
    function clear(mapping(int24 => Tick.Info) storage self, int24 tick)
        internal
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
        int256 fixedTokenGrowthGlobalX128,
        int256 variableTokenGrowthGlobalX128,
        uint256 feeGrowthGlobalX128
    ) internal returns (int128 liquidityNet) {
        Tick.Info storage info = self[tick];

        info.feeGrowthOutsideX128 =
            feeGrowthGlobalX128 -
            info.feeGrowthOutsideX128;

        info.fixedTokenGrowthOutsideX128 =
            fixedTokenGrowthGlobalX128 -
            info.fixedTokenGrowthOutsideX128;

        Printer.printInt24("tick crossed", tick);
        Printer.printInt256("variableTokenGrowthGlobalX128", variableTokenGrowthGlobalX128);
        Printer.printInt256("info.variableTokenGrowthOutsideX128", info.variableTokenGrowthOutsideX128);

        info.variableTokenGrowthOutsideX128 =
            variableTokenGrowthGlobalX128 -
            info.variableTokenGrowthOutsideX128;

        liquidityNet = info.liquidityNet;
    }
}
