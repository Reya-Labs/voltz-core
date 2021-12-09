// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IDeployer.sol";
import "./interfaces/IVAMM.sol";
import "./interfaces/IAMM.sol";
import "./core_libraries/TickBitmap.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";

import "./utils/SafeCast.sol";
import "./utils/LowGasSafeMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./core_libraries/SwapMath.sol";

import "hardhat/console.sol";
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "./core_libraries/UnwindTraderUnwindPosition.sol";

contract VAMM is IVAMM {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    using TickBitmap for mapping(int16 => uint256); // todo: resolve the issue with tick bitmap

    uint256 public immutable override fee; // 0.3%=0.003 of the total notional

    int24 public immutable override tickSpacing;

    uint128 public immutable override maxLiquidityPerTick;

    mapping(int24 => Tick.Info) public override ticks;
    mapping(int16 => uint256) public override tickBitmap;

    constructor() {
        address _ammAddress;
        int24 _tickSpacing;
        
        (
            _ammAddress,
            fee,
            _tickSpacing
        ) = IDeployer(msg.sender).vammParameters();        

        amm = IAMM(_ammAddress);

        tickSpacing = _tickSpacing;

        maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(_tickSpacing); 

    }
    
    Slot0 public override slot0; // todo: rename, no longer the 0th slot

    int256 public override fixedTokenGrowthGlobal;

    int256 public override variableTokenGrowthGlobal;

    uint256 public override feeGrowthGlobal;

    uint128 public override liquidity;

    uint256 public override protocolFees;

    IAMM public override amm;
    
    modifier onlyAMM () {
        require(address(amm) != address(0));
        require(msg.sender == address(amm));
        _;
    }    

    function setAMM(address _ammAddress) external onlyAMM override {
        amm = IAMM(_ammAddress);
    }

    // todo: do we need a lock in here?
    function updateProtocolFees(uint256 protocolFeesCollected) external onlyAMM override {
        require(protocolFeesCollected <= protocolFees, "Can't withdraw more than have");
        // todo: alternative less severe implementation
        // amount = amountRequested > protocolFees ? protocolFees : amountRequested;
        protocolFees = PRBMathUD60x18Typed.sub(
            PRBMath.UD60x18({
                value: protocolFees
            }),
            PRBMath.UD60x18({
                value: protocolFeesCollected
            })
        ).value;
    }
    
    /// @dev not locked because it initializes unlocked
    function initialize(uint160 sqrtPriceX96) external onlyAMM override {
        require(slot0.sqrtPriceX96 == 0, "AI");

        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

        slot0 = Slot0({sqrtPriceX96: sqrtPriceX96, tick: tick, feeProtocol: 0});

        amm.setUnlocked(true);

        emit Initialize(sqrtPriceX96, tick);
    }

    function setFeeProtocol(uint256 feeProtocol) external override onlyAMM {
        // todo: introduce checks
        slot0.feeProtocol = feeProtocol;
        // todo: emit set fee protocol
    }
    
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override {

        modifyPosition(
            ModifyPositionParams({
                owner: msg.sender,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: -int256(uint256(amount)).toInt128() // todo: toInt128 vs. int128()
            })
        );

        amm.marginEngine().unwindPosition(msg.sender, tickLower, tickUpper);
        
    }
    
    function flipTicks(ModifyPositionParams memory params) internal returns(bool flippedLower, bool flippedUpper) {
        
        flippedLower = ticks.update(
            params.tickLower,
            slot0.tick,
            params.liquidityDelta,
            fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal,
            feeGrowthGlobal,
            false,
            maxLiquidityPerTick
        );
        flippedUpper = ticks.update(
            params.tickUpper,
            slot0.tick,
            params.liquidityDelta,
            fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal,
            feeGrowthGlobal,
            true,
            maxLiquidityPerTick
        );

        if (flippedLower) {
            tickBitmap.flipTick(params.tickLower, tickSpacing);
        }
        if (flippedUpper) {
            tickBitmap.flipTick(params.tickUpper, tickSpacing);
        }

    }


    function updatePosition(
        ModifyPositionParams memory params
    )
        private
    {

        uint256 _feeGrowthGlobal = feeGrowthGlobal;

        UpdatePositionVars memory vars;

        if (params.liquidityDelta != 0) {
            // update the ticks if necessary
            (vars.flippedLower, vars.flippedUpper) = flipTicks(params);
        }
        
        vars.fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
            }) 
        );

        vars.variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                variableTokenGrowthGlobal: variableTokenGrowthGlobal
            })
        );

        vars.feeGrowthInside = ticks.getFeeGrowthInside(
            params.tickLower,
            params.tickUpper,
            slot0.tick,
            feeGrowthGlobal
        );

        amm.marginEngine().updatePosition(params, vars);

        // clear any tick data that is no longer needed
        if (params.liquidityDelta < 0) {
            if (vars.flippedLower) {
                // amm.clearTicks(params.tickLower);
                ticks.clear(params.tickLower);
            }
            if (vars.flippedUpper) {
                ticks.clear(params.tickUpper);
                // amm.clearTicks(params.tickUpper);
            }
        }
    }
    
    function modifyPosition(ModifyPositionParams memory params)
        private
    {
        Tick.checkTicks(params.tickLower, params.tickUpper);

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        updatePosition(params);

        amm.rateOracle().writeOrcleEntry(amm.underlyingToken());

        if (params.liquidityDelta != 0) {
            
            if ((_slot0.tick >= params.tickLower) && (_slot0.tick < params.tickUpper)) {

                // current tick is inside the passed range
                uint128 liquidityBefore = liquidity; // SLOAD for gas optimization

                liquidity = LiquidityMath.addDelta(
                    liquidityBefore,
                    params.liquidityDelta
                );
            }

        }
    }
    
    
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external override {
        require(amount > 0);

        // Position.Info storage position = amm.positions(recipient, tickLower, tickUpper);
        // todo: have a helper function that just pulls the margin for the following call
        amm.marginEngine().checkPositionMarginRequirementSatisfied(recipient, tickLower, tickUpper, amount);
        
        // todo: liqudiity delta is the liquidity of the position after the amount is deposited
        
        modifyPosition(
            ModifyPositionParams({
                owner: recipient,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(amount)).toInt128()
            })
        );

        emit Mint(
            msg.sender,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

    // todo: can be in a separate library (but not reused elsewhere)
    function calculateUpdatedGlobalTrackerValues(
        SwapParams memory params,
        SwapState memory state,
        StepComputations memory step,
        uint256 variableFactor
        ) internal view returns(uint256 stateFeeGrowthGlobal, int256 stateVariableTokenGrowthGlobal, int256 stateFixedTokenGrowthGlobal) {

        stateFeeGrowthGlobal = PRBMathUD60x18Typed.add(

                    PRBMath.UD60x18({
                        value: state.feeGrowthGlobal
                    }),

                    PRBMathUD60x18Typed.div(

                        PRBMath.UD60x18({
                            value: step.feeAmount
                        }),

                        PRBMath.UD60x18({
                            value: uint256(state.liquidity)
                        })
                    )
        ).value;

        if (params.isFT) {

            stateVariableTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: state.variableTokenGrowthGlobal
                }),

                PRBMathSD59x18Typed.div(

                    PRBMath.SD59x18({
                        value: int256(step.amountOut)
                    }),

                    PRBMath.SD59x18({
                        value: int256(uint256(state.liquidity))
                    })
                )
            ).value;

            stateFixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: state.fixedTokenGrowthGlobal
                }),

                PRBMathSD59x18Typed.div(

                    PRBMath.SD59x18({
                        // todo: check the signs
                        value: FixedAndVariableMath.getFixedTokenBalance(-int256(step.amountIn), int256(step.amountOut), variableFactor, amm.termStartTimestamp(), amm.termEndTimestamp())
                    }),

                    PRBMath.SD59x18({
                        value: int256(uint256(state.liquidity))
                    })
                )
            ).value;
        } else {

            stateVariableTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: state.variableTokenGrowthGlobal
                }),

                PRBMathSD59x18Typed.div(

                    PRBMath.SD59x18({
                        // todo: check the signs are correct
                        value: -int256(step.amountIn)
                    }),

                    PRBMath.SD59x18({
                        value: int256(uint256(state.liquidity))
                    })
                )
            ).value;

            stateFixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(
                PRBMath.SD59x18({
                    value: state.fixedTokenGrowthGlobal
                }),

                PRBMathSD59x18Typed.div(

                    PRBMath.SD59x18({
                        // todo: check the signs are correct
                        // int256 amount0,
                        // int256 amount1,
                        // uint256 accruedVariableFactor,
                        // uint256 termStartTimestamp,
                        // uint256 termEndTimestamp
                        // (stopped here)
                        
                        value: FixedAndVariableMath.getFixedTokenBalance(int256(step.amountOut), -int256(step.amountIn), variableFactor, amm.termStartTimestamp(), amm.termEndTimestamp()) // variable factor maturity false
                    }),

                    PRBMath.SD59x18({
                        value: int256(uint256(state.liquidity))
                    })
                )
            ).value;

        }
        
        

    }
    
    function accountForProtocolFees(uint256 stepFeeAmount, uint256 cacheFeeProtocol, uint256 stateProtocolFee) internal view returns (uint256, uint256) {

        PRBMath.UD60x18 memory delta = PRBMathUD60x18Typed.mul(            
            PRBMath.UD60x18({
                value: stepFeeAmount
            }),

            PRBMath.UD60x18({
                value: cacheFeeProtocol // as a percentage of LP fees
            })
        );

        stepFeeAmount = PRBMathUD60x18Typed.sub(            
            PRBMath.UD60x18({value: stepFeeAmount}),
            delta
        ).value;
        

        stateProtocolFee = PRBMathUD60x18Typed.add(
                    
            PRBMath.UD60x18({
                value: stateProtocolFee
            }),

            delta
                
        ).value;

        return (stepFeeAmount, stateProtocolFee);

    }
    
    // todo: more swap params in the struct
    function swap(
        SwapParams memory params
    ) external override returns (int256 _fixedTokenDelta, int256 _variableTokenDelta){
        require(params.amountSpecified != 0, "AS");

        Slot0 memory slot0Start = slot0;

        require(amm.unlocked(), "LOK");

        require(
            params.isFT
                ? params.sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 &&
                    params.sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
                : params.sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 &&
                    params.sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,
            "SPL"
        );

        // slot0.unlocked = false;
        amm.setUnlocked(false);

        SwapCache memory cache = SwapCache({
            liquidityStart: liquidity,
            blockTimestamp: FixedAndVariableMath.blockTimestampScaled(),
            feeProtocol: slot0.feeProtocol 
        });

        // bool exactInput = params.amountSpecified > 0;

        SwapState memory state = SwapState({
            amountSpecifiedRemaining: params.amountSpecified,
            amountCalculated: 0,
            sqrtPriceX96: slot0Start.sqrtPriceX96,
            tick: slot0Start.tick,
            liquidity: cache.liquidityStart,
            fixedTokenGrowthGlobal: fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal: variableTokenGrowthGlobal,
            feeGrowthGlobal: feeGrowthGlobal,
            protocolFee: 0
        });

        amm.rateOracle().writeOrcleEntry(amm.underlyingToken());

        // continue swapping as long as we haven't used the entire input/output and haven't reached the price (implied fixed rate) limit
        while (
            state.amountSpecifiedRemaining != 0 &&
            state.sqrtPriceX96 != params.sqrtPriceLimitX96
        ) {
            StepComputations memory step;

            step.sqrtPriceStartX96 = state.sqrtPriceX96;

            (step.tickNext, step.initialized) = tickBitmap
                .nextInitializedTickWithinOneWord(
                    state.tick,
                    tickSpacing,
                    params.isFT
                );

            // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
            if (step.tickNext < TickMath.MIN_TICK) {
                step.tickNext = TickMath.MIN_TICK;
            } else if (step.tickNext > TickMath.MAX_TICK) {
                step.tickNext = TickMath.MAX_TICK;
            }

            // get the price for the next tick
            step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

            uint256 timeToMaturityInSeconds = PRBMathUD60x18Typed.sub(
                    
                PRBMath.UD60x18({
                    value: amm.termEndTimestamp()
                }),

                PRBMath.UD60x18({
                    value: FixedAndVariableMath.blockTimestampScaled()
                })

            ).value;

            // compute values to swap to the target tick, price limit, or point where input/output amount is exhausted
            (state.sqrtPriceX96, step.amountIn, step.amountOut, step.feeAmount) = SwapMath
                .computeSwapStep(
                    state.sqrtPriceX96,
                    (
                        params.isFT
                            ? step.sqrtPriceNextX96 < params.sqrtPriceLimitX96
                            : step.sqrtPriceNextX96 > params.sqrtPriceLimitX96
                    )
                        ? params.sqrtPriceLimitX96
                        : step.sqrtPriceNextX96,
                    state.liquidity,
                    state.amountSpecifiedRemaining,
                    fee,
                    timeToMaturityInSeconds
                );

            if (params.amountSpecified > 0) {
                // exact input
                state.amountSpecifiedRemaining -= (step.amountIn).toInt256();
                state.amountCalculated = state.amountCalculated.sub(
                    (step.amountOut).toInt256()
                );
            } else {
                // todo: prb math is not used in here
                state.amountSpecifiedRemaining += step.amountOut.toInt256();
                state.amountCalculated = state.amountCalculated.add(
                    (step.amountIn).toInt256()
                );
            }

            // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
            if (cache.feeProtocol > 0) {
                (step.feeAmount, state.protocolFee) = accountForProtocolFees(step.feeAmount, cache.feeProtocol, state.protocolFee);
            }

            // update global fee tracker
            if (state.liquidity > 0) {  
                uint256 variableFactor = amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp());             
                (state.feeGrowthGlobal, state.variableTokenGrowthGlobal, state.fixedTokenGrowthGlobal) = calculateUpdatedGlobalTrackerValues(params, state, step, variableFactor);
            }

            // shift tick if we reached the next price
            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                // if the tick is initialized, run the tick transition
                if (step.initialized) {
                    // int128 liquidityNet = amm.crossTicks(
                    //     step.tickNext,
                    //     state.fixedTokenGrowthGlobal,
                    //     state.variableTokenGrowthGlobal,
                    //     state.feeGrowthGlobal
                    // );
                    int128 liquidityNet = ticks.cross(
                        step.tickNext,
                        state.fixedTokenGrowthGlobal,
                        state.variableTokenGrowthGlobal,
                        state.feeGrowthGlobal
                    );

                    // if we're moving leftward, we interpret liquidityNet as the opposite sign
                    // safe because liquidityNet cannot be type(int128).min
                    if (params.isFT) liquidityNet = -liquidityNet;

                    state.liquidity = LiquidityMath.addDelta(
                        state.liquidity,
                        liquidityNet
                    );
                }

                state.tick = params.isFT ? step.tickNext - 1 : step.tickNext;
            } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
                // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
                state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
            }
        }

        if (state.tick != slot0Start.tick) {
            slot0.sqrtPriceX96 = state.sqrtPriceX96;
            slot0.tick = state.tick;
        } else {
            slot0.sqrtPriceX96 = state.sqrtPriceX96;
        }

        // update liquidity if it changed
        if (cache.liquidityStart != state.liquidity) liquidity = state.liquidity;
        feeGrowthGlobal = state.feeGrowthGlobal;
        variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
        fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;
        
        if (state.protocolFee > 0) {
            protocolFees = PRBMathUD60x18Typed
            .add(
                PRBMath.UD60x18({value: protocolFees}),
                PRBMath.UD60x18({value: state.protocolFee})
            )
            .value;
        }

        (int256 amount0Int, int256 amount1Int) = params.isFT == params.amountSpecified > 0
            ? (
                params.amountSpecified - state.amountSpecifiedRemaining,
                state.amountCalculated
            )
            : (
                state.amountCalculated,
                params.amountSpecified - state.amountSpecifiedRemaining
            );
        
        uint256 amount0;
        uint256 amount1;
        
        if (amount0Int > 0) {
            require(amount1Int<0, "amount0 and amount1 should have opposite signs");
            amount0 = uint256(amount0Int);   
            amount1 = uint256(-amount1Int);
        } else if (amount1Int > 0) {
            require(amount0Int<0, "amount0 and amount1 should have opposite signs");
            amount0 = uint256(-amount0Int);
            amount1 = uint256(amount1Int);
        }
    
        if (params.isFT) {
            _variableTokenDelta = -int256(amount1); // todo: use delta instead of balance
            _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(int256(amount0), -int256(amount1), amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()), amm.termStartTimestamp(), amm.termEndTimestamp());
        } else {
            _variableTokenDelta = int256(amount1);
            _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(-int256(amount0), int256(amount1), amm.rateOracle().variableFactor(false, amm.underlyingToken(), amm.termStartTimestamp(), amm.termEndTimestamp()), amm.termStartTimestamp(), amm.termEndTimestamp());
        }

        // if this is not the case then it is a position unwind induced swap triggered by a position liquidation which is handled in the position unwind function
        if (params.isTrader) {
            amm.marginEngine().updateTraderBalances(params.recipient, _fixedTokenDelta, _variableTokenDelta);
        }
        
        emit Swap(
            msg.sender,
            params.recipient,
            state.sqrtPriceX96,
            state.liquidity,
            state.tick
        );

        // slot0.unlocked = true;
        amm.setUnlocked(true);
    }

    function computePositionFixedAndVariableGrowthInside(ModifyPositionParams memory params, int24 currentTick)
     external view override returns(int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) {

        fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: currentTick,
                fixedTokenGrowthGlobal: variableTokenGrowthGlobal
            }) 
        ); 

        variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: currentTick,
                variableTokenGrowthGlobal: variableTokenGrowthGlobal
            })
        );

    }

}
