pragma solidity ^0.8.0;
import "./utils/NoDelegateCall.sol";
import "./core_libraries/Tick.sol";
import "./interfaces/IAMMDeployer.sol";
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
import "./interfaces/IAaveRateOracle.sol";

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./utils/TransferHelper.sol";
import "./core_libraries/FixedAndVariableMath.sol";


contract AMM is IAMM, NoDelegateCall {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using SafeCast for uint256;
    using SafeCast for int256;
    using Tick for mapping(int24 => Tick.Info);
    using TickBitmap for mapping(int16 => uint256); // todo: resolve the issue with tick bitmap
    
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    using Trader for mapping(bytes32 => Trader.Info);
    using Trader for Trader.Info;

    address public immutable override factory;

    address public immutable override underlyingToken;

    address public immutable override underlyingPool;

    uint256 public immutable override termEndTimestamp;

    uint256 public immutable override termStartTimestamp;

    uint24 public immutable override fee;

    uint256 public constant LIQUIDATOR_REWARD = 2 * 10**15; // 0.2%=0.002 of the total margin (or remaining?)

    int24 public immutable override tickSpacing;

    uint128 public immutable override maxLiquidityPerTick;

    int256 public override fixedTokenGrowthGlobal;

    int256 public override variableTokenGrowthGlobal;

    // uint256 public override balance0;
    // uint256 public override balance1;

    IMarginCalculator public override calculator;
    
    IAaveRateOracle public override rateOracle; 

    constructor() {
        int24 _tickSpacing;
        (
            factory,
            underlyingToken,
            underlyingPool,
            termEndTimestamp,
            termStartTimestamp,
            fee,
            _tickSpacing
        ) = IAMMDeployer(msg.sender).parameters();
        tickSpacing = _tickSpacing;
        maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(
            _tickSpacing
        );
    }

    struct Slot0 {
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // whether the pool is locked
        bool unlocked;
    }

    Slot0 public override slot0;

    uint128 public override liquidity;

    mapping(int24 => Tick.Info) public override ticks;
    mapping(int16 => uint256) public override tickBitmap;
    mapping(bytes32 => Position.Info) public override positions;
    mapping(bytes32 => Trader.Info) public override traders;

    /// @dev Mutually exclusive reentrancy protection into the pool to/from a method. This method also prevents entrance
    /// to a function before the pool is initialized. The reentrancy guard is required throughout the contract because
    /// we use balance checks to determine the payment status of interactions such as mint, swap and flash. // todo: understand better
    modifier lock() {
        require(slot0.unlocked, "LOK");
        slot0.unlocked = false;
        _;
        slot0.unlocked = true;
    }

    /// @dev Common checks for valid tick inputs.
    function checkTicks(int24 tickLower, int24 tickUpper) private pure {
        require(tickLower < tickUpper, "TLU");
        require(tickLower >= TickMath.MIN_TICK, "TLM");
        require(tickUpper <= TickMath.MAX_TICK, "TUM");
    }

    /// @dev not locked because it initializes unlocked
    function initialize(uint160 sqrtPriceX96) external override {
        require(slot0.sqrtPriceX96 == 0, "AI"); // todo: what does AI mean?

        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

        slot0 = Slot0({sqrtPriceX96: sqrtPriceX96, tick: tick, unlocked: true});

        emit Initialize(sqrtPriceX96, tick);
    }

    struct PositionMarginRequirementParams {
        address owner;
        int24 tickLower;
        int24 tickUpper;
        bool isLM;
    }

    struct PositionMarginRequirementsVars {
        int256 fixedTokenGrowthInside;
        int256 variableTokenGrowthInside;

        int256 amount0;
        int256 amount1;

        int256 expectedVariableTokenBalance;
        int256 expectedFixedTokenBalance;

        int256 amount0Up;
        int256 amount1Up;

        int256 amount0Down;
        int256 amount1Down;

        int256 expectedVariableTokenBalanceAfterUp;
        int256 expectedFixedTokenBalanceAfterUp;

        int256 expectedVariableTokenBalanceAfterDown;
        int256 expectedFixedTokenBalanceAfterDown;

        uint256 marginReqAfterUp;
        uint256 marginReqAfterDown;

    }

    function getPositionMarginRequirement(PositionMarginRequirementParams memory params) public returns (uint256 margin) {

        //todo: check if position's liqudity delta is not zero

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);

        PositionMarginRequirementsVars memory vars;
        
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

        position.updateFixedAndVariableTokenGrowthInside(vars.fixedTokenGrowthInside, vars.variableTokenGrowthInside);

        // todo: only update the  necessary quantities
        // position.update(position.liquidityDelta, position.feeGrowthInsideX128, position.margin, fixedTokenGrowthInside, variableTokenGrowthInside);

        vars.amount0 = SqrtPriceMath.getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    int128(position.liquidity)
        );
    

        vars.amount1 = SqrtPriceMath.getAmount1Delta(
            TickMath.getSqrtRatioAtTick(params.tickLower),
            TickMath.getSqrtRatioAtTick(params.tickUpper),
            int128(position.liquidity)
        );

        // tood: fix amount signs and conver to uint256
        
        if (slot0.tick < params.tickLower) {

            if (position.variableTokenBalance > 0) {
                revert(); // this should not be possible
            } else if (position.variableTokenBalance < 0) {
                // means the trader deposited on the other side of the tick rang
                // the margin just covers the current balances of the position
                
                margin = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: position.fixedTokenBalance,
                        variableTokenBalance: position.variableTokenBalance,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );

                // margin = calculator.getTraderMarginRequirement(
                //     position.fixedTokenBalance,
                //     position.variableTokenBalance,
                //     termStartTimestamp,
                //     termEndTimestamp,
                //     params.isLM
                // );
            } else {
                // the variable token balance is 0
                vars.expectedVariableTokenBalance = int256(vars.amount1);
                vars.expectedFixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(vars.amount0, vars.amount1, rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp);

                margin = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            }

        } else if (slot0.tick < params.tickUpper) {

            // going up balance delta
            // todo: make sure the signs are correct
            vars.amount0Up = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(slot0.tick),
                TickMath.getSqrtRatioAtTick(params.tickUpper),
                int128(position.liquidity)
            );
            vars.amount1Up = SqrtPriceMath.getAmount1Delta(
                TickMath.getSqrtRatioAtTick(slot0.tick),
                TickMath.getSqrtRatioAtTick(params.tickUpper),
                int128(position.liquidity)
            );

            // todo: convert to uints in here
            
            vars.expectedVariableTokenBalanceAfterUp = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: position.variableTokenBalance
                }),

                PRBMath.SD59x18({
                    value: -int256(vars.amount1Up)
                })

            ).value;

            vars.expectedFixedTokenBalanceAfterUp = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: position.fixedTokenBalance
                }),

                PRBMath.SD59x18({
                    // value: -int256(FixedAndVariableMath.getFixedTokenBalance(uint256(vars.amount0Up), uint256(vars.amount1Up), int256(variableFactor(false)), false, termStartTimestamp, termEndTimestamp))
                    value: FixedAndVariableMath.getFixedTokenBalance(vars.amount0Up, vars.amount1Up, rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)

                })

            ).value;

            uint256 marginReqAfterUp = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterUp,
                        variableTokenBalance: vars.expectedVariableTokenBalanceAfterUp,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            // going down balance delta
            vars.amount0Down = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(params.tickLower),
                TickMath.getSqrtRatioAtTick(slot0.tick),
                int128(position.liquidity)
            );

            vars.amount1Down = SqrtPriceMath.getAmount0Delta(
                TickMath.getSqrtRatioAtTick(params.tickLower),
                TickMath.getSqrtRatioAtTick(slot0.tick),
                int128(position.liquidity)
            );

            // todo: fix the signs and convert to uint

            
            vars.expectedVariableTokenBalanceAfterDown = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: position.variableTokenBalance
                }),

                PRBMath.SD59x18({
                    value: -int256(vars.amount1Down)
                })

            ).value;

            vars.expectedFixedTokenBalanceAfterDown = PRBMathSD59x18Typed.add(

                PRBMath.SD59x18({
                    value: position.fixedTokenBalance
                }),

                PRBMath.SD59x18({
                    value: FixedAndVariableMath.getFixedTokenBalance(vars.amount0Down, vars.amount1Down, rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)
                })

            ).value;

            vars.marginReqAfterDown = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterDown,
                        variableTokenBalance: vars.expectedVariableTokenBalanceAfterDown,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );

        
            if (vars.marginReqAfterUp > vars.marginReqAfterDown) {
                margin = marginReqAfterUp;
            } else {
                margin = vars.marginReqAfterDown;
            }

        } else {

            if (position.variableTokenBalance < 0) {
                revert(); // this should not be possible
            } else if (position.variableTokenBalance > 0) {
                // means the trader deposited on the other side of the tick rang
                // the margin just covers the current balances of the position
                
                margin = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: position.fixedTokenBalance,
                        variableTokenBalance: position.variableTokenBalance,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );

            } else {
                // the variable token balance is 0
                vars.expectedVariableTokenBalance = -int256(vars.amount1);
                vars.expectedFixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(vars.amount0, vars.amount1, rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp);

                margin = calculator.getTraderMarginRequirement(
                    IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: vars.expectedFixedTokenBalance,
                        variableTokenBalance: vars.expectedVariableTokenBalance,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: params.isLM
                    })
                );
                
            }
            
        }

    }
    

    function _isLiquidatableTrader(
        address traderAddress
    ) internal view returns(bool isLiquidatable) {

        // todo: liquidation only supported by accounts that are not fully collateralised
        // todo: cannot liquidate expired position?

        Trader.Info storage trader = traders.get(traderAddress);

        uint256 marginRequirement = calculator.getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: true
            })
        );
        
        // uint256 marginRequirement = calculator.getTraderMarginRequirement(trader.fixedTokenBalance, trader.variableTokenBalance, termStartTimestamp, termEndTimestamp, true);
        
        if (trader.margin < int256(marginRequirement)) {
            isLiquidatable = true;
        } else {
            isLiquidatable = false;
        }
    
    }


    // todo: should be view
    function _isLiquidatablePosition(address owner, int24 tickLower, int24 tickUpper) internal returns(bool _isLiquidatable) {

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        
        PositionMarginRequirementParams memory marginReqParams;
        (marginReqParams.owner, marginReqParams.tickLower, marginReqParams.tickUpper, marginReqParams.isLM) = (owner, tickLower, tickUpper, true);


        uint256 marginRequirement = getPositionMarginRequirement(marginReqParams);
        if (position.margin < int256(marginRequirement)) {
            _isLiquidatable = true;
        } else {
            _isLiquidatable = false;
        }

    }

    function liquidatePosition(ModifyPositionParams memory params) external {

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);
        bool isLiquidatable = _isLiquidatablePosition(params.owner, params.tickLower, params.tickUpper);

        require(isLiquidatable, "The position needs to be below the liquidation threshold to be liquidated");

        uint256 liquidatorReward = PRBMathUD60x18Typed.mul(

            PRBMath.UD60x18({
                value: uint256(position.margin) // todo: position.margin should be a uint256
            }),

            PRBMath.UD60x18({
                value: LIQUIDATOR_REWARD
            })

        ).value;

        position.updateMargin(-int256(liquidatorReward));

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorReward);

        burn(params.tickLower, params.tickUpper, position.liquidity); // burn all liquidity
        
    }

    struct LiquidateTraderParams {
        // address of the trader
        address traderAddress;
        // address of the liquidator
        // address liquidatorAddress;
        
        // chainlink round id
        // uint256 roundId;
    }

    /**
     * @notice liquidate a liquidatable trader
     * @param params liquidation action arguments struct
    */
    function liquidateTrader(LiquidateTraderParams memory params) external {
        
        Trader.Info storage trader = traders.get(params.traderAddress);
        
        bool isLiquidatable = _isLiquidatableTrader(params.traderAddress);

        require(isLiquidatable, "The trader needs to be below the liquidation threshold to be liquidated");

        int256 notional = trader.variableTokenBalance > 0 ? trader.variableTokenBalance : -trader.variableTokenBalance;

        // todo: calculate the reward of the liquidator
        uint256 liquidatorReward = PRBMathUD60x18Typed.mul(

            PRBMath.UD60x18({
                value: uint256(trader.margin)
            }),

            PRBMath.UD60x18({
                value: LIQUIDATOR_REWARD
            })
        ).value;

        int256 updatedMargin = PRBMathSD59x18Typed.sub(

            PRBMath.SD59x18({
                value: trader.margin
            }),

            PRBMath.SD59x18({
                value: int256(liquidatorReward)
            })
        ).value;

        trader.updateMargin(updatedMargin);

        IERC20Minimal(underlyingToken).transferFrom(address(this), msg.sender, liquidatorReward);

        unwindTrader(params.traderAddress, notional);

    }

     
    function unwindTrader(
        address traderAddress,
        int256 notional // absolute value of the variableToken balance
    ) public {

        Trader.Info storage trader = traders.get(traderAddress);

        bool isFT = notional > 0;

        if (isFT) {
            // get into a VT swap
            // notional is positive

            SwapParams memory params = SwapParams({
               recipient: traderAddress,
               isFT: !isFT,
               amountSpecified: -notional,
               sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
               isUnwind: true,
               isTrader: true,
               proposedMargin: 0 
            });

            swap(params); // min price --> modifyTrader then updates the trader

        } else {
            // get into an FT swap
            // notional is negative
            
            SwapParams memory params = SwapParams({
               recipient: traderAddress,
               isFT: isFT,
               amountSpecified: notional,
               sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
               isUnwind: true,
               isTrader: true,
               proposedMargin: 0 
            });

            swap(params); // max price --> modifyTrader then updates the trader

        }


    }
    
    function unwindPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public {
        
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        // check if the position needs to be unwound in the first place (check if the variable token balance is nonzero)

        checkTicks(tickLower, tickUpper);

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        UpdatePositionParams memory updatePositionParams;

        updatePositionParams.owner = owner;
        updatePositionParams.tickLower = tickLower;
        updatePositionParams.tickUpper = tickUpper;
        updatePositionParams.liquidityDelta = 0;
        updatePositionParams.tick = _slot0.tick;

        // update the position
        _updatePosition(updatePositionParams);

        // initiate a swap
        bool isFT = position.fixedTokenBalance > 0;
        int256 _fixedTokenBalance;
        int256 _variableTokenBalance;

        if (isFT) {
            // get into a VT swap
            // variableTokenBalance is negative

            SwapParams memory params = SwapParams({
               recipient: owner,
               isFT: !isFT,
               amountSpecified: position.variableTokenBalance,
               sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
               isUnwind: true,
               isTrader: false,
               proposedMargin: 0
            });

            (_fixedTokenBalance, _variableTokenBalance) = swap(params); // min price --> modifyTrader then updates the trader

        } else {
            // get into an FT swap
            // variableTokenBalance is positive
            
            SwapParams memory params = SwapParams({
               recipient: owner,
               isFT: isFT,
               amountSpecified: position.variableTokenBalance,
               sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
               isUnwind: true,
               isTrader: false,
               proposedMargin: 0 // todo: is this the best choice?
            });

            (_fixedTokenBalance, _variableTokenBalance) = swap(params); // max price --> modifyTrader then updates the trader

        }

        position.updateBalances(_fixedTokenBalance, _variableTokenBalance);

    }
    
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) public lock {

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        (Position.Info storage position, int256 amount0Int, int256 amount1Int) =
            _modifyPosition(
                ModifyPositionParams({
                    owner: msg.sender,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: -int256(uint256(amount)).toInt128()
                })
            );

        unwindPosition(msg.sender, tickLower, tickUpper);
        
    }

    struct ModifyPositionParams {
        // the address that owns the position
        address owner;
        // the lower and upper tick of the position
        int24 tickLower;
        int24 tickUpper;
        // any change in liquidity
        int128 liquidityDelta;
    }

    
    // todo: can be migrated into the Position.sol contract
    // function settlePosition(ModifyPositionParams memory params) public {
        
    //     // check if the current block is more or equal to maturity

    //     checkTicks(params.tickLower, params.tickUpper);

    //     Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

    //     UpdatePositionParams memory updatePositionParams;

    //     updatePositionParams.owner = params.owner;
    //     updatePositionParams.tickLower = params.tickLower;
    //     updatePositionParams.tickUpper = params.tickUpper;
    //     updatePositionParams.liquidityDelta = params.liquidityDelta;
    //     updatePositionParams.tick = _slot0.tick;

    //     // update the position
    //     _updatePosition(updatePositionParams);
        
    //     Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);

    //     // todo: code repetition below
    //     PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

    //         PRBMath.SD59x18({
    //             value: position.fixedTokenBalance
    //         }),

    //         PRBMath.SD59x18({
    //             value: int256(FixedAndVariableMath.fixedFactor(true, termStartTimestamp, termEndTimestamp))
    //         })
    //     );

        
    //     PRBMath.SD59x18 memory exp2 = PRBMathSD59x18Typed.mul(

    //         PRBMath.SD59x18({
    //             value: position.variableTokenBalance
    //         }),

    //         PRBMath.SD59x18({
    //             value: int256(variableFactor(true))
    //         })
    //     );

    //     int256 irsCashflow = PRBMathSD59x18Typed.add(exp1, exp2).value;

    //     position.updateMargin(irsCashflow);

    //     // IERC20Minimal(underlyingToken).transferFrom(recipient, address(this), uint256(margin));

    // }

    struct UpdatePositionParams {
        // the address that owns the position
        address owner;
        // the lower and upper tick of the position
        int24 tickLower;
        int24 tickUpper;
        // any change in liquidity
        int128 liquidityDelta;

        int24 tick;

        uint256 _feeGrowthGlobalX128;
        int256 _notionalGrowthGlobal;
        int256 _notionalGlobal;
        int256 _fixedRateGlobal;
        int256 _fixedTokenGrowthGlobal;
        int256 _variableTokenGrowthGlobal;

        bool flippedLower;
        bool flippedUpper;

        uint256 feeGrowthInsideX128;

        int256 fixedTokenGrowthInside;

        int256 variableTokenGrowthInside;

    }
    

    function _updatePosition(
        UpdatePositionParams memory params
    )
        private
        returns (
            Position.Info storage position
        )
    {
        position = positions.get(params.owner, params.tickLower, params.tickUpper);

        // params._feeGrowthGlobalX128 = feeGrowthGlobalX128; // SLOAD for gas optimization
        // params._notionalGrowthGlobal = notionalGrowthGlobal;
        // params._notionalGlobal = notionalGlobal; 
        // params._fixedRateGlobal = fixedRateGlobal;
        params._fixedTokenGrowthGlobal = fixedTokenGrowthGlobal;
        params._variableTokenGrowthGlobal = variableTokenGrowthGlobal;

    
        
        // if we need to update the ticks, do it
        if (params.liquidityDelta != 0) {
            params.flippedLower = ticks.update(
                params.tickLower,
                params.tick,
                params.liquidityDelta,
                params._fixedTokenGrowthGlobal,
                params._variableTokenGrowthGlobal,
                false,
                maxLiquidityPerTick
            );
            params.flippedUpper = ticks.update(
                params.tickUpper,
                params.tick,
                params.liquidityDelta,
                params._fixedTokenGrowthGlobal,
                params._variableTokenGrowthGlobal,
                true,
                maxLiquidityPerTick
            );

            if (params.flippedLower) {
                tickBitmap.flipTick(params.tickLower, tickSpacing);
            }
            if (params.flippedUpper) {
                tickBitmap.flipTick(params.tickUpper, tickSpacing);
            }
        }

        // todo: get rid of this for now
        // params.feeGrowthInsideX128 = ticks.getFeeGrowthInside(
        //     params.tickLower,
        //     params.tickUpper,
        //     params.tick,
        //     params._feeGrowthGlobalX128
        // );

        params.fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: params.tick,
                fixedTokenGrowthGlobal: params._fixedTokenGrowthGlobal
            }) 
        );

        params.variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: params.tick,
                variableTokenGrowthGlobal: params._variableTokenGrowthGlobal
            })
        );

        position.updateLiquidity(params.liquidityDelta);
        position.updateFixedAndVariableTokenGrowthInside(params.fixedTokenGrowthInside, params.variableTokenGrowthInside);
        
        // clear any tick data that is no longer needed
        if (params.liquidityDelta < 0) {
            if (params.flippedLower) {
                ticks.clear(params.tickLower);
            }
            if (params.flippedUpper) {
                ticks.clear(params.tickUpper);
            }
        }
    }


    
    /// @param params the position details and the change to the position's liquidity to effect
    /// @return position a storage pointer referencing the position with the given owner and tick range
    function _modifyPosition(ModifyPositionParams memory params)
        private
        noDelegateCall
        returns (
            Position.Info storage position,
            int256 amount0,
            int256 amount1
        )
    {
        checkTicks(params.tickLower, params.tickUpper);

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        
        UpdatePositionParams memory updatePositionParams;

        // todo: below feels redundunt
        updatePositionParams.owner = params.owner;
        updatePositionParams.tickLower = params.tickLower;
        updatePositionParams.tickUpper = params.tickUpper;
        updatePositionParams.liquidityDelta = params.liquidityDelta;
        updatePositionParams.tick = _slot0.tick;

        
        // todo: TypeError: This variable is of storage pointer type and can be returned without prior assignment, which would lead to undefined behaviour.
        // when move the assignment to the bottom of the function
        position = _updatePosition(updatePositionParams);

        if (params.liquidityDelta != 0) {
            if (_slot0.tick < params.tickLower) {
                // current tick is below the passed range; liquidity can only become in range by crossing from left to
                // right, when we'll need _more_ token0 (it's becoming more valuable) so user must provide it
                // TODO: dig into these functions
                amount0 = SqrtPriceMath.getAmount0Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    params.liquidityDelta
                );
            } else if (_slot0.tick < params.tickUpper) {
                // current tick is inside the passed range
                uint128 liquidityBefore = liquidity; // SLOAD for gas optimization

                amount0 = SqrtPriceMath.getAmount0Delta(
                    _slot0.sqrtPriceX96,
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    params.liquidityDelta
                );

                amount1 = SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    _slot0.sqrtPriceX96,
                    params.liquidityDelta
                );

                liquidity = LiquidityMath.addDelta(
                    liquidityBefore,
                    params.liquidityDelta
                );
            } else {
                // current tick is above the passed range; liquidity can only become in range by crossing from right to
                // left, when we'll need _more_ token1 (it's becoming more valuable) so user must provide it
                amount1 = SqrtPriceMath.getAmount1Delta(
                    TickMath.getSqrtRatioAtTick(params.tickLower),
                    TickMath.getSqrtRatioAtTick(params.tickUpper),
                    params.liquidityDelta
                );
            }
        }
    }

    function getRatioFromSqrt(
     uint160 sqrtRatio
    ) internal returns(uint160 ratio){

        ratio = uint160(PRBMathUD60x18Typed.mul(

            PRBMath.UD60x18({
                value: sqrtRatio
            }),

            PRBMath.UD60x18({
                value: sqrtRatio
            })
        ).value);
    }
    
    /// @dev noDelegateCall is applied indirectly via _modifyPosition
    function mint(
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount,
        bytes calldata data
    ) external override lock {
        require(amount > 0);

        (, int256 amount0Int, int256 amount1Int) = _modifyPosition(
            ModifyPositionParams({
                owner: recipient,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(amount)).toInt128()
            })
        );

        Position.Info storage position = positions.get(recipient, tickLower, tickUpper);

        // todo: check the sign of integers
        // position.updateAmounts(amount0Int, amount1Int);

        Slot0 memory _slot0 = slot0;

        PositionMarginRequirementParams memory marginReqParams;

        (marginReqParams.owner, marginReqParams.tickLower, marginReqParams.tickUpper, marginReqParams.isLM) = (recipient, tickLower, tickUpper, false);

        int256 margin = int256(getPositionMarginRequirement(marginReqParams));

        IERC20Minimal(underlyingToken).transferFrom(recipient, address(this), uint256(margin));

        position.updateMargin(margin);

        emit Mint(
            msg.sender,
            recipient,
            tickLower,
            tickUpper,
            amount
        );
    }

    struct SwapCache {
        // liquidity at the beginning of the swap
        uint128 liquidityStart;
        // the timestamp of the current block
        uint256 blockTimestamp;
    }

    // the top level state of the swap, the results of which are recorded in storage at the end
    struct SwapState {
        // the amount remaining to be swapped in/out of the input/output asset
        int256 amountSpecifiedRemaining;
        // the amount already swapped out/in of the output/input asset
        int256 amountCalculated;
        // current sqrt(price)
        uint160 sqrtPriceX96;
        // the tick associated with the current price
        int24 tick;
        // the global fee growth of the input token
        // uint256 feeGrowthGlobalX128;

        // int256 notionalGrowthGlobal;
        // int256 notionalGlobal;
        // int256 fixedRateGlobal;

        int256 fixedTokenGrowthGlobal;

        int256 variableTokenGrowthGlobal;

        // the current liquidity in range
        uint128 liquidity;
    }

    struct StepComputations {
        // the price at the beginning of the step
        uint160 sqrtPriceStartX96;
        // the next tick to swap to from the current tick in the swap direction
        int24 tickNext;
        // whether tickNext is initialized or not
        bool initialized;
        // sqrt(price) for the next tick (1/0)
        uint160 sqrtPriceNextX96;
        // how much is being swapped in in this step
        uint256 amountIn;
        // how much is being swapped out
        uint256 amountOut;

        int256 notionalAmount;
        int256 fixedRate;

        uint256 amount0;
        uint256 amount1;

    }

    struct InitiateIRSParams {
        // trader's address
        address traderAddress;
        // the lower and upper tick of the position

        int256 fixedTokenBalance;
        int256 variableTokenBalance;

        int256 margin;
        bool settled;
    }
    

    function updateTrader(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance, int256 proposedMargin) public {

        Trader.Info storage trader = traders.get(recipient);
        trader.updateBalances(fixedTokenBalance, variableTokenBalance);
        
        uint256 timePeriodInSeconds = termEndTimestamp - termStartTimestamp;

        int256 margin = int256(calculator.getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: false
            })
        ));

        if (proposedMargin > margin) {
            margin = proposedMargin;
        }

        if (margin > trader.margin) {
            int256 marginDelta = PRBMathSD59x18Typed.mul(

                PRBMath.SD59x18({
                    value: margin
                }),

                PRBMath.SD59x18({
                    value: trader.margin
                })
            ).value;

            IERC20Minimal(underlyingToken).transferFrom(recipient, address(this), uint256(marginDelta));

            trader.updateMargin(margin);
        
        }

    }
    
    function swap(
        SwapParams memory params
    ) public override noDelegateCall returns (int256 _fixedTokenBalance, int256 _variableTokenBalance){
        require(params.amountSpecified != 0, "AS");

        Slot0 memory slot0Start = slot0;

        require(slot0Start.unlocked, "LOK");

        require(
            params.isFT
                ? params.sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 &&
                    params.sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
                : params.sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 &&
                    params.sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,
            "SPL"
        );

        slot0.unlocked = false;

        SwapCache memory cache = SwapCache({
            liquidityStart: liquidity,
            blockTimestamp: block.timestamp
        });

        // bool exactInput = params.amountSpecified > 0;

        SwapState memory state = SwapState({
            amountSpecifiedRemaining: params.amountSpecified,
            amountCalculated: 0,
            sqrtPriceX96: slot0Start.sqrtPriceX96,
            tick: slot0Start.tick,
            // feeGrowthGlobalX128: feeGrowthGlobalX128,
            liquidity: cache.liquidityStart,
            // notionalGrowthGlobal: notionalGrowthGlobal,
            // notionalGlobal: notionalGlobal,
            // fixedRateGlobal: fixedRateGlobal,
            fixedTokenGrowthGlobal: fixedTokenGrowthGlobal,
            variableTokenGrowthGlobal: variableTokenGrowthGlobal
        });

        // continue swapping as long as we haven't used the entire input/output and haven't reached the price limit
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

            // compute values to swap to the target tick, price limit, or point where input/output amount is exhausted
            (state.sqrtPriceX96, step.amountIn, step.amountOut, step.notionalAmount, step.fixedRate,
            step.amount0, step.amount1) = SwapMath
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
                    state.amountSpecifiedRemaining
                );

            if (params.amountSpecified > 0) {
                state.amountSpecifiedRemaining -= (step.amountIn).toInt256();
                state.amountCalculated = state.amountCalculated.sub(
                    (step.amountOut).toInt256()
                );
            } else {
                state.amountSpecifiedRemaining += step.amountOut.toInt256();
                state.amountCalculated = state.amountCalculated.add(
                    (step.amountIn).toInt256()
                );
            }

            // update global fee tracker
            if (state.liquidity > 0) {
                // state.feeGrowthGlobalX128 += FullMath.mulDiv(0, FixedPoint128.Q128, state.liquidity); // todo: set to zero for now

                if (params.isFT) {
                    // then the AMM is a VT

                    state.variableTokenGrowthGlobal = int256(step.amount1);

                    state.fixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                        PRBMath.SD59x18({
                            value: state.fixedTokenGrowthGlobal
                        }),

                        PRBMathSD59x18Typed.div(

                            PRBMath.SD59x18({
                                // value: FixedAndVariableMath.getFixedTokenBalance(step.amount0, step.amount1, int256(variableFactor(false)), !params.isFT, termStartTimestamp, termEndTimestamp)
                                value: FixedAndVariableMath.getFixedTokenBalance(int256(step.amount0), int256(step.amount1), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)
                            }),

                            PRBMath.SD59x18({
                                value: int256(uint256(state.liquidity))
                            })
                        )
                    ).value;

                } else {
                    // then the AMM is an FT

                    state.variableTokenGrowthGlobal = -int256(step.amount1); // todo: redundunt code, fix during testing

                    state.fixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                        PRBMath.SD59x18({
                            value: state.fixedTokenGrowthGlobal
                        }),


                        PRBMathSD59x18Typed.div(

                            PRBMath.SD59x18({
                                // value: FixedAndVariableMath.getFixedTokenBalance(step.amount0, step.amount1, int256(variableFactor(false)), params.isFT, termStartTimestamp, termEndTimestamp)
                                // todo: check the amount0 and amount1 signs
                                value: FixedAndVariableMath.getFixedTokenBalance(int256(step.amount0), int256(step.amount1), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)
                            }),

                            PRBMath.SD59x18({
                                value: int256(uint256(state.liquidity))
                            })
                        )
                    ).value;

                }
            }

            // shift tick if we reached the next price
            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                // if the tick is initialized, run the tick transition
                if (step.initialized) {
                    // todo: tweak this
                    int128 liquidityNet = ticks.cross(
                        step.tickNext,
                        state.fixedTokenGrowthGlobal,
                        state.variableTokenGrowthGlobal
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
        if (cache.liquidityStart != state.liquidity)
            liquidity = state.liquidity;

        (int256 amount0, int256 amount1) = params.isFT == params.amountSpecified > 0
            ? (
                params.amountSpecified - state.amountSpecifiedRemaining,
                state.amountCalculated
            )
            : (
                state.amountCalculated,
                params.amountSpecified - state.amountSpecifiedRemaining
            );

        // feeGrowthGlobalX128 = state.feeGrowthGlobalX128;
        // notionalGrowthGlobal = state.notionalGrowthGlobal;
        // notionalGlobal = state.notionalGlobal;
        // fixedRateGlobal = state.fixedRateGlobal;

        variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
        fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;
        

        // bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp

        _fixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(amount0, amount1, rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp);

        if (params.isFT) {
            _variableTokenBalance = -int256(uint256(amount1));
        } else {
            _variableTokenBalance = int256(uint256(amount1));
        }

        if (params.isTrader) {
                updateTrader(params.recipient, _fixedTokenBalance, _variableTokenBalance, params.proposedMargin);
        }
        

        emit Swap(
            msg.sender,
            params.recipient,
            amount0,
            amount1,
            state.sqrtPriceX96,
            state.liquidity,
            state.tick
        );

        slot0.unlocked = true;
    }
}
