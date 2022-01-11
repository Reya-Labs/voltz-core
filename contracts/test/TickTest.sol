// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../core_libraries/Tick.sol";

contract TickTest {
    using Tick for mapping(int24 => Tick.Info);

    mapping(int24 => Tick.Info) public ticks;

    function setTick(int24 tick, Tick.Info memory info) external {
        ticks[tick] = info;
    }

    // DONE
    function checkTicks(int24 tickLower, int24 tickUpper) public pure {
        return Tick.checkTicks(tickLower, tickUpper);
    }

    // DONE
    function getFeeGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        uint256 feeGrowthGlobal
    ) external view returns (uint256 feeGrowthInside) {
        return
            ticks.getFeeGrowthInside(
                tickLower,
                tickUpper,
                tickCurrent,
                feeGrowthGlobal
            );
    }

    // DONE
    // function tickSpacingToMaxLiquidityPerTick(int24 tickSpacing)
    //     public
    //     pure
    //     returns (uint128)
    // {
    //     return Tick.tickSpacingToMaxLiquidityPerTick(tickSpacing);
    // }

    // DONE
    function getVariableTokenGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int256 variableTokenGrowthGlobal
    ) public view returns (int256 variableTokenGrowthInside) {
        return
            ticks.getVariableTokenGrowthInside(
                Tick.VariableTokenGrowthInsideParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickCurrent: tickCurrent,
                    variableTokenGrowthGlobal: variableTokenGrowthGlobal
                })
            );
    }

    // DONE
    function getFixedTokenGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int256 fixedTokenGrowthGlobal
    ) public view returns (int256 fixedTokenGrowthInside) {
        return
            ticks.getFixedTokenGrowthInside(
                Tick.FixedTokenGrowthInsideParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickCurrent: tickCurrent,
                    fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
                })
            );
    }

    // DONE
    function update(
        int24 tick,
        int24 tickCurrent,
        int128 liquidityDelta,
        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,
        uint256 feeGrowthGlobal,
        bool upper,
        uint128 maxLiquidity
    ) external returns (bool flipped) {
        return
            ticks.update(
                tick,
                tickCurrent,
                liquidityDelta,
                fixedTokenGrowthGlobal,
                variableTokenGrowthGlobal,
                feeGrowthGlobal,
                upper,
                maxLiquidity
            );
    }

    // DONE
    function clear(int24 tick) external {
        ticks.clear(tick);
    }

    // DONE
    function cross(
        int24 tick,
        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,
        uint256 feeGrowthGlobal
    ) external returns (int128 liquidityNet) {
        return
            ticks.cross(
                tick,
                fixedTokenGrowthGlobal,
                variableTokenGrowthGlobal,
                feeGrowthGlobal
            );
    }
}
