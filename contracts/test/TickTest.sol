// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

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
        uint256 feeGrowthGlobalX128
    ) external view returns (uint256 feeGrowthInsideX128) {
        return
            ticks.getFeeGrowthInside(
                Tick.FeeGrowthInsideParams(
                    tickLower,
                    tickUpper,
                    tickCurrent,
                    feeGrowthGlobalX128
                )
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
        int256 variableTokenGrowthGlobalX128
    ) public view returns (int256 variableTokenGrowthInsideX128) {
        return
            ticks.getVariableTokenGrowthInside(
                Tick.VariableTokenGrowthInsideParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickCurrent: tickCurrent,
                    variableTokenGrowthGlobalX128: variableTokenGrowthGlobalX128
                })
            );
    }

    // DONE
    function getFixedTokenGrowthInside(
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int256 fixedTokenGrowthGlobalX128
    ) public view returns (int256 fixedTokenGrowthInsideX128) {
        return
            ticks.getFixedTokenGrowthInside(
                Tick.FixedTokenGrowthInsideParams({
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    tickCurrent: tickCurrent,
                    fixedTokenGrowthGlobalX128: fixedTokenGrowthGlobalX128
                })
            );
    }

    // DONE
    function update(
        int24 tick,
        int24 tickCurrent,
        int128 liquidityDelta,
        int256 fixedTokenGrowthGlobalX128,
        int256 variableTokenGrowthGlobalX128,
        uint256 feeGrowthGlobalX128,
        bool upper,
        uint128 maxLiquidity
    ) external returns (bool flipped) {
        return
            ticks.update(
                tick,
                tickCurrent,
                liquidityDelta,
                fixedTokenGrowthGlobalX128,
                variableTokenGrowthGlobalX128,
                feeGrowthGlobalX128,
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
        int256 fixedTokenGrowthGlobalX128,
        int256 variableTokenGrowthGlobalX128,
        uint256 feeGrowthGlobalX128
    ) external returns (int128 liquidityNet) {
        return
            ticks.cross(
                tick,
                fixedTokenGrowthGlobalX128,
                variableTokenGrowthGlobalX128,
                feeGrowthGlobalX128
            );
    }
}
