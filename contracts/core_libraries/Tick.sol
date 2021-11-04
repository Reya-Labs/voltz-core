// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../utils/LowGasSafeMath.sol";
import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../utils/LiquidityMath.sol";

import "prb-math/contracts/PRBMathSD59x18Typed.sol";

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
        uint256 feeGrowthOutsideX128;

        int256 notionalGrowthOutside;

        int256 notionalOutside;

        int256 fixedRateOutside;

        int256 fixedTokenGrowthOutside;
        int256 variableTokenGrowthOutside;

        bool initialized;

    }

    /// @notice Derives max liquidity per tick from given tick spacing
    /// @dev Executed within the pool constructor
    /// @param tickSpacing The amount of required tick separation, realized in multiples of `tickSpacing`
    ///     e.g., a tickSpacing of 3 requires ticks to be initialized every 3rd tick i.e., ..., -6, -3, 0, 3, 6, ...
    /// @return The max liquidity per tick
    function tickSpacingToMaxLiquidityPerTick(int24 tickSpacing)
        internal
        pure
        returns (uint128)
    {
        int24 minTick = (TickMath.MIN_TICK / tickSpacing) * tickSpacing;
        int24 maxTick = (TickMath.MAX_TICK / tickSpacing) * tickSpacing;
        uint24 numTicks = uint24((maxTick - minTick) / tickSpacing) + 1;
        return type(uint128).max / numTicks;
    }

    function getFixedRateOtherSide(int256 notionalGlobal, int256 fixedRateGlobal, int256 fixedRateOutside, int256 notionalOutside) 
            internal pure returns (PRBMath.SD59x18 memory fixedRateOtherSideUD) {

        PRBMath.SD59x18 memory exp1UD = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                    value: fixedRateGlobal
                }),

            PRBMath.SD59x18({
                value: notionalGlobal
            })

        );

        PRBMath.SD59x18 memory exp2UD = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                    value: fixedRateOutside
                }),

            PRBMath.SD59x18({
                value: notionalOutside
            })

        );

        PRBMath.SD59x18 memory numeratorUD = PRBMathSD59x18Typed.sub(exp1UD, exp2UD);
        
        PRBMath.SD59x18 memory denominatorUD = PRBMathSD59x18Typed.sub(
            PRBMath.SD59x18({
                    value: notionalGlobal
                }),

            PRBMath.SD59x18({
                value: notionalOutside
            })
        );

        fixedRateOtherSideUD = PRBMathSD59x18Typed.div(numeratorUD, denominatorUD);

    }
    
    
    // todo: better name
    struct FixedRateInsideParams {

        int24 tickLower;
        int24 tickUpper;
        int24 tickCurrent;
        int256 fixedRateGlobal;
        int256 notionalGlobal;

        PRBMath.SD59x18 fixedRateBelowUD;
        PRBMath.SD59x18 fixedRateAboveUD;


        PRBMath.SD59x18 exp1UD;
        PRBMath.SD59x18 exp2UD;
        PRBMath.SD59x18 exp3UD;
        PRBMath.SD59x18 numerator;
        PRBMath.SD59x18 denominator;
    
    }


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

            variableTokenGrowthBelow = PRBMathSD59x18Typed.sub(

                PRBMath.SD59x18({
                    value: params.variableTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: lower.variableTokenGrowthOutside
                })
            ).value;

        }


        // calculate the VariableTokenGrowth above
        int256 variableTokenGrowthAbove;

        if (params.tickCurrent < params.tickUpper) {
            variableTokenGrowthAbove = upper.variableTokenGrowthOutside;
        } else {

            variableTokenGrowthAbove = PRBMathSD59x18Typed.sub(

                PRBMath.SD59x18({
                    value: params.variableTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: upper.variableTokenGrowthOutside
                })
            ).value;
        }


        variableTokenGrowthInside = PRBMathSD59x18Typed.sub(

            PRBMath.SD59x18({
                value: params.variableTokenGrowthGlobal
            }),

            PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: variableTokenGrowthBelow
                }),

                PRBMath.SD59x18({
                    value: variableTokenGrowthAbove
                })
            )
                
        ).value;

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

            fixedTokenGrowthBelow = PRBMathSD59x18Typed.sub(

                PRBMath.SD59x18({
                    value: params.fixedTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: lower.fixedTokenGrowthOutside
                })
            ).value;

        }


        // calculate the FixedTokenGrowth above
        int256 fixedTokenGrowthAbove;

        if (params.tickCurrent < params.tickUpper) {
            fixedTokenGrowthAbove = upper.fixedTokenGrowthOutside;
        } else {

            fixedTokenGrowthAbove = PRBMathSD59x18Typed.sub(

                PRBMath.SD59x18({
                    value: params.fixedTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: upper.fixedTokenGrowthOutside
                })
            ).value;
        }


        fixedTokenGrowthInside = PRBMathSD59x18Typed.sub(

            PRBMath.SD59x18({
                value: params.fixedTokenGrowthGlobal
            }),

            PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: fixedTokenGrowthBelow
                }),

                PRBMath.SD59x18({
                    value: fixedTokenGrowthAbove
                })
            )
                
        ).value;

    }
    
    
    function getFixedRateInside(
        mapping(int24 => Tick.Info) storage self,
        FixedRateInsideParams memory params
    ) internal view returns (int256 fixedRateInside) {

        Info storage lower = self[params.tickLower];
        Info storage upper = self[params.tickUpper];

        if (params.tickCurrent >= params.tickLower) {

            params.fixedRateBelowUD = PRBMath.SD59x18({
                value: lower.fixedRateOutside
            });
            
        } else {

            params.fixedRateBelowUD = getFixedRateOtherSide(params.notionalGlobal, params.fixedRateGlobal, lower.fixedRateOutside, lower.notionalOutside);

        }
        
        if (params.tickCurrent < params.tickUpper) {

            params.fixedRateAboveUD = getFixedRateOtherSide(params.notionalGlobal, params.fixedRateGlobal, upper.fixedRateOutside, upper.notionalOutside);

        } else {

            params.fixedRateAboveUD = PRBMath.SD59x18({
                value: lower.fixedRateOutside
            });

        }


        params.exp1UD = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                    value: params.fixedRateGlobal
                }),

            PRBMath.SD59x18({
                value: params.notionalGlobal
            })

        ); 

        params.exp2UD = PRBMathSD59x18Typed.mul(

            params.fixedRateBelowUD,

            PRBMath.SD59x18({
                value: getNotionalBelow(self, params.tickLower, params.tickCurrent, params.notionalGlobal)
            })

        );

        params.exp3UD = PRBMathSD59x18Typed.mul(

            params.fixedRateAboveUD,

            PRBMath.SD59x18({
                value: getNotionalAbove(self, params.tickUpper, params.tickCurrent, params.notionalGlobal)
            })

        ); 

        params.numerator = PRBMathSD59x18Typed.sub(PRBMathSD59x18Typed.sub(params.exp1UD, params.exp2UD), params.exp3UD);

        params.denominator = PRBMathSD59x18Typed.sub(
            PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: params.notionalGlobal
                }),

                PRBMath.SD59x18({
                    value: getNotionalBelow(self, params.tickLower, params.tickCurrent, params.notionalGlobal)
                })
             ),
             
            PRBMath.SD59x18({
                value: getNotionalAbove(self, params.tickUpper, params.tickCurrent, params.notionalGlobal)
            })
        );


        PRBMath.SD59x18 memory fixedRateInsideUD = PRBMathSD59x18Typed.div(params.numerator, params.denominator);

        fixedRateInside = fixedRateInsideUD.value;
        
    }
    
    
    function getNotionalBelow(
        mapping(int24 => Tick.Info) storage self,
        int24 tickLower,
        int24 tickCurrent,
        int256 notionalGlobal
        ) internal view returns (int256 notionalBelow) {

        Info storage lower = self[tickLower]; // todo: can directly pass lower
        
        PRBMath.SD59x18 memory notionalBelowUD;
        
        if (tickCurrent >= tickLower) {
        
            notionalBelowUD = PRBMath.SD59x18({
                value: lower.notionalOutside
            });
        } else {

            notionalBelowUD = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGlobal
                }),

                PRBMath.SD59x18({
                    value: lower.notionalOutside
                })
            );
        }

        notionalBelow = notionalBelowUD.value;

    }
    
    function getNotionalAbove(
        mapping(int24 => Tick.Info) storage self,
        int24 tickUpper,
        int24 tickCurrent,
        int256 notionalGlobal
        ) internal view returns (int256 notionalAbove) {

        Info storage upper = self[tickUpper]; 

        PRBMath.SD59x18 memory notionalAboveUD;
        
        if (tickCurrent < tickUpper) {
        
            notionalAboveUD = PRBMath.SD59x18({
                value: upper.notionalOutside
            });

        } else {

            notionalAboveUD = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGlobal
                }),

                PRBMath.SD59x18({
                    value: upper.notionalOutside
                })
            );
        }

        notionalAbove = notionalAboveUD.value;
    
    }
    
    function getNotionalGrowthInside(
        mapping(int24 => Tick.Info) storage self,
        int24 tickLower,
        int24 tickUpper,
        int24 tickCurrent,
        int256 notionalGrowthGlobal
    ) internal view returns (int256 notionalGrowthInside) {

        Info storage lower = self[tickLower];
        Info storage upper = self[tickUpper];

        PRBMath.SD59x18 memory notionalGrowthBelowUD;
        
        if (tickCurrent >= tickLower) {
        
            notionalGrowthBelowUD = PRBMath.SD59x18({
                value: lower.notionalGrowthOutside
            });
        } else {

            notionalGrowthBelowUD = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: lower.notionalGrowthOutside
                })
            );
        }

        PRBMath.SD59x18 memory notionalGrowthAboveUD;
        
        if (tickCurrent < tickUpper) {
        
            notionalGrowthAboveUD = PRBMath.SD59x18({
                value: upper.notionalGrowthOutside
            });
        } else {

            notionalGrowthAboveUD = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: upper.notionalGrowthOutside
                })
            );
        }

        PRBMath.SD59x18 memory notionalGrowthInsideUD = PRBMathSD59x18Typed.sub(PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGrowthGlobal
                }),
                notionalGrowthBelowUD
            ), notionalGrowthAboveUD);

        notionalGrowthInside = notionalGrowthInsideUD.value;

    }
    
    
    /// @notice Retrieves fee growth data
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tickLower The lower tick boundary of the position
    /// @param tickUpper The upper tick boundary of the position
    /// @param tickCurrent The current tick
    /// @param feeGrowthGlobalX128 The all-time global fee growth, per unit of liquidity, in token0
    /// @return feeGrowthInsideX128 The all-time fee growth, per unit of liquidity, inside the position's tick boundaries
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

    /// @notice Updates a tick and returns true if the tick was flipped from initialized to uninitialized, or vice versa
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The tick that will be updated
    /// @param tickCurrent The current tick
    /// @param liquidityDelta A new amount of liquidity to be added (subtracted) when tick is crossed from left to right (right to left)
    /// @param feeGrowthGlobalX128 The all-time global fee growth, per unit of liquidity
    /// @param upper true for updating a position's upper tick, or false for updating a position's lower tick
    /// @param maxLiquidity The maximum liquidity allocation for a single tick
    /// @return flipped Whether the tick was flipped from initialized to uninitialized, or vice versa
    function update(
        mapping(int24 => Tick.Info) storage self,
        int24 tick,
        int24 tickCurrent,
        int128 liquidityDelta,
        uint256 feeGrowthGlobalX128,

        int256 notionalGrowthGlobal,
        int256 notionalGlobal,
        int256 fixedRateGlobal,

        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal,

        bool upper,
        uint128 maxLiquidity
    ) internal returns (bool flipped) {
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
                
                info.notionalGrowthOutside = notionalGrowthGlobal;

                info.notionalOutside = notionalGlobal;

                info.fixedRateOutside = fixedRateGlobal;

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
        internal
    {
        delete self[tick];
    }

    /// @notice Transitions to next tick as needed by price movement
    /// @param self The mapping containing all tick information for initialized ticks
    /// @param tick The destination tick of the transition
    /// @param feeGrowthGlobalX128 The all-time global fee growth, per unit of liquidity, in underlying token
    /// @return liquidityNet The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
    function cross(
        mapping(int24 => Tick.Info) storage self,
        int24 tick,
        uint256 feeGrowthGlobalX128,
        int256 notionalGrowthGlobal,
        int256 notionalGlobal,
        int256 fixedRateGlobal,

        int256 fixedTokenGrowthGlobal,
        int256 variableTokenGrowthGlobal
        
    ) internal returns (int128 liquidityNet) {
        Tick.Info storage info = self[tick];
        info.feeGrowthOutsideX128 =
            feeGrowthGlobalX128 -
            info.feeGrowthOutsideX128;

        info.fixedTokenGrowthOutside = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: fixedTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: info.fixedTokenGrowthOutside
                })
        ).value;

        info.variableTokenGrowthOutside = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: variableTokenGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: info.variableTokenGrowthOutside
                })
        ).value;
        
        info.notionalGrowthOutside = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGrowthGlobal
                }),

                PRBMath.SD59x18({
                    value: info.notionalGrowthOutside
                })
        ).value;

        info.notionalOutside = PRBMathSD59x18Typed.sub(
                PRBMath.SD59x18({
                    value: notionalGlobal
                }),

                PRBMath.SD59x18({
                    value: info.notionalOutside
                })
        ).value;

        info.fixedRateOutside = getFixedRateOtherSide(notionalGlobal, fixedRateGlobal, info.fixedRateOutside, info.notionalOutside).value;

        liquidityNet = info.liquidityNet;
    }
}
