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

    uint256 public immutable override termInDays;

    uint256 public immutable override termStartTimestamp;

    uint24 public immutable override fee;

    int24 public immutable override tickSpacing;

    uint128 public immutable override maxLiquidityPerTick;

    uint256 public override feeGrowthGlobalX128;

    int256 public override notionalGrowthGlobal;

    int256 public override notionalGlobal;

    int256 public override fixedRateGlobal;

    int256 public override fixedTokenGrowthGlobal;

    int256 public override variableTokenGrowthGlobal;

    uint256 public override balance0;
    uint256 public override balance1;

    IMarginCalculator public override calculator;
    
    IAaveRateOracle public override rateOracle; 

    constructor() {
        int24 _tickSpacing;
        (
            factory,
            underlyingToken,
            underlyingPool,
            termInDays,
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



    // function unwindPosition(
    //     address owner,
    //     int24 tickLower,
    //     int24 tickUpper,
    //     int256 fixedRate,
    //     int256 notional
    //     // bytes calldata data
    // ) internal {
        
    //     // todo: returns position
    //     // traderU is unnecessary
    //     (int256 cashflow, Trader.Info memory traderU) = unwind(owner, fixedRate, notional);
        
    //     // todo: redundunt: getting position twice
    //     Position.Info storage position = positions.get(owner, tickLower, tickUpper);

    //     int256 updatedMargin = PRBMathSD59x18Typed.sub(

    //         PRBMath.SD59x18({
    //             value: position.margin
    //         }),

    //         PRBMath.SD59x18({
    //             value: cashflow
    //         })
    
    //     ).value;

    //     position.update(0, position.feeGrowthInsideLastX128, updatedMargin);

    // }

    // function unwindTrader(
    //     address recipient,
    //     int256 fixedRate,
    //     int256 notional
    //     // bytes calldata data
    // ) public {

    //     // traderU is unnecessary
    //     (int256 cashflow, Trader.Info memory traderU) = unwind(recipient, fixedRate, notional);

    //     Trader.Info storage trader = traders.get(recipient, notional, uint256(fixedRate));

    //     int256 updatedMargin = PRBMathSD59x18Typed.sub(

    //         PRBMath.SD59x18({
    //             value: trader.margin
    //         }),

    //         PRBMath.SD59x18({
    //             value: cashflow
    //         })
    
    //     ).value;

    //     trader.update(trader.notional, trader.fixedRate, updatedMargin, true);
    
    // }
    
    function unwind(
        address recipient,
        int256 fixedRate,
        int256 notional
        // bytes calldata data
    ) public noDelegateCall returns(int256 cashflow, Trader.Info memory traderU){

        // todo: require statement for notional to not be 0

        bool isFT = notional > 0;
        uint256 termEndTimeStamp = termStartTimestamp + (termInDays * 24 * 60 * 60);
        
        if (isFT) {
            // get into a VT swap
            // notional is positive
            // -traderU.notional is negative
            // todo: this swap doesn't require margin calculation

            SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: !isFT,
               amountSpecified: -notional,
               sqrtPriceLimitX96: TickMath.MIN_SQRT_RATIO,
               isUnwind: true
            });

            traderU = swap(params); // min price            
            
            cashflow = calculator.getUnwindSettlementCashflow(notional, int256(fixedRate), traderU.notional, 
                int256(traderU.fixedRate), termEndTimeStamp - _blockTimestamp());

        } else {
            // get into an FT swap
            // notional is negative
            
            SwapParams memory params = SwapParams({
               recipient: recipient,
               isFT: isFT,
               amountSpecified: notional,
               sqrtPriceLimitX96: TickMath.MAX_SQRT_RATIO,
               isUnwind: true
            });

            traderU = swap(params); // max price

            cashflow = calculator.getUnwindSettlementCashflow(notional, int256(fixedRate), traderU.notional, 
                int256(traderU.fixedRate), termEndTimeStamp - _blockTimestamp());
        }


        // todo: require if isUnwind in swap for amountSpecified to be negative

    }
    
    
    function burn(
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external lock {

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
        
        uint256 amount0 = uint256(-amount0Int);
        uint256 amount1 = uint256(-amount1Int);

        
        int256 notionalGrowthInside = ticks.getNotionalGrowthInside(tickLower, tickUpper, _slot0.tick, notionalGrowthGlobal);
        
        int256 notionalAmount = PRBMathSD59x18Typed.mul(
            PRBMath.SD59x18({
                value: notionalGrowthInside
            }),
            PRBMath.SD59x18({
                value: int256(int128(amount))
            })
        ).value;

        
        int256 fixedRateInside = ticks.getFixedRateInside(
            Tick.FixedRateInsideParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                tickCurrent: _slot0.tick,
                fixedRateGlobal: fixedRateGlobal,
                notionalGlobal: notionalGlobal,
                fixedRateBelowUD: PRBMath.SD59x18({value: 0}),
                fixedRateAboveUD: PRBMath.SD59x18({value: 0}),

                exp1UD: PRBMath.SD59x18({value: 0}),
                exp2UD: PRBMath.SD59x18({value: 0}),
                exp3UD: PRBMath.SD59x18({value: 0}),
                numerator: PRBMath.SD59x18({value: 0}),
                denominator: PRBMath.SD59x18({value: 0})
            }) 
        );

        // unwindPosition(msg.sender, tickLower, tickUpper,  fixedRateInside, notionalAmount);

        // collectCashflows()

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
    function settlePosition(ModifyPositionParams memory params) public {
        
        // check if the current block is more or equal to maturity

        checkTicks(params.tickLower, params.tickUpper);

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        UpdatePositionParams memory updatePositionParams;

        updatePositionParams.owner = params.owner;
        updatePositionParams.tickLower = params.tickLower;
        updatePositionParams.tickUpper = params.tickUpper;
        updatePositionParams.liquidityDelta = params.liquidityDelta;
        updatePositionParams.tick = _slot0.tick;

        // update the position
        _updatePosition(updatePositionParams);
        
        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);

        // todo: code repetition below
        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: position.fixedTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(fixedFactor(true))
            })
        );

        
        PRBMath.SD59x18 memory exp2 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: position.variableTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(variableFactor(true))
            })
        );

        int256 irsCashflow = PRBMathSD59x18Typed.add(exp1, exp2).value;

        int256 updatedMargin = PRBMathSD59x18Typed.add(

            PRBMath.SD59x18({
                value: position.margin
            }),

            PRBMath.SD59x18({
                value: irsCashflow
            })
        ).value;

        position.update(0, position.feeGrowthInsideLastX128, updatedMargin, 0, 0);

    }

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

        params._feeGrowthGlobalX128 = feeGrowthGlobalX128; // SLOAD for gas optimization
        params._notionalGrowthGlobal = notionalGrowthGlobal;
        params._notionalGlobal = notionalGlobal; 
        params._fixedRateGlobal = fixedRateGlobal;
        params._fixedTokenGrowthGlobal = fixedTokenGrowthGlobal;
        params._variableTokenGrowthGlobal = variableTokenGrowthGlobal;

        // if we need to update the ticks, do it
        if (params.liquidityDelta != 0) {
            params.flippedLower = ticks.update(
                params.tickLower,
                params.tick,
                params.liquidityDelta,
                params._feeGrowthGlobalX128,
                notionalGrowthGlobal,
                notionalGlobal,
                fixedRateGlobal,
                params._fixedTokenGrowthGlobal,
                params._variableTokenGrowthGlobal,
                false,
                maxLiquidityPerTick
            );
            params.flippedUpper = ticks.update(
                params.tickUpper,
                params.tick,
                params.liquidityDelta,
                params._feeGrowthGlobalX128,
                notionalGrowthGlobal,
                notionalGlobal,
                fixedRateGlobal,
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

        params.feeGrowthInsideX128 = ticks.getFeeGrowthInside(
            params.tickLower,
            params.tickUpper,
            params.tick,
            params._feeGrowthGlobalX128
        );

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

        position.update(params.liquidityDelta, params.feeGrowthInsideX128, position.margin, params.fixedTokenGrowthInside, params.variableTokenGrowthInside); // todo: make sure position margin works

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

        uint256 amount0 = uint256(amount0Int);
        uint256 amount1 = uint256(amount1Int);

        // todo: deposit margin in here or in modifyPosition (at the end)?

        Slot0 memory _slot0 = slot0;
        uint256 termEndTimeStamp = termStartTimestamp + (termInDays * 24 * 60 * 60);

        int256 margin = int256(calculator.getLPMarginRequirement(
            TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper),
            amount0,
            amount1,
            TickMath.getSqrtRatioAtTick(_slot0.tick),
            termEndTimeStamp - _blockTimestamp(),
            false
        ));

        
        if (amount0 > 0) balance0 = balance0.add(amount0); // todo: this seems redundunt
        if (amount1 > 0) balance1 = balance1.add(amount1);

        emit Mint(
            msg.sender,
            recipient,
            tickLower,
            tickUpper,
            amount,
            amount0,
            amount1
        );
    }

    struct SwapCache {
        // liquidity at the beginning of the swap
        uint128 liquidityStart;
        // the timestamp of the current block
        uint32 blockTimestamp;
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
        uint256 feeGrowthGlobalX128;

        int256 notionalGrowthGlobal;
        int256 notionalGlobal;
        int256 fixedRateGlobal;

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

    

    /// @dev Returns the block timestamp truncated to 32 bits, i.e. mod 2**32. This method is overridden in tests.
    function _blockTimestamp() internal view virtual returns (uint32) {
        return uint32(block.timestamp); // truncation is desired
    }

    struct InitiateIRSParams {
        // trader's address
        address traderAddress;
        // the lower and upper tick of the position
        int256 notional;
        uint256 fixedRate;            

        int256 fixedTokenBalance;
        int256 variableTokenBalance;

        int256 margin;
        bool settled;
    }


    function _initiateIRS(InitiateIRSParams memory params) private noDelegateCall returns(Trader.Info storage trader) {
        
        trader = traders.get(params.traderAddress, params.notional, params.fixedRate);

        trader.update(params.notional, params.fixedRate, params.fixedTokenBalance, params.variableTokenBalance, params.margin, params.settled);

    }

    struct SettleTraderParams {
        address traderAddress;
        int256 notional;
        uint256 fixedRate;            
    }
    
    
    function settleTrader(InitiateIRSParams memory params) public noDelegateCall {

        // check if the current block is more or equal to maturity

        Trader.Info storage trader = traders.get(params.traderAddress, params.notional, params.fixedRate);

        // update the margin to essentially be equal to tokens owned
        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: trader.fixedTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(fixedFactor(true))
            })
        );

        PRBMath.SD59x18 memory exp2 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: trader.variableTokenBalance
            }),

            PRBMath.SD59x18({
                value: int256(variableFactor(true))
            })
        );

        int256 irsCashflow = PRBMathSD59x18Typed.add(exp1, exp2).value;

        int256 updatedMargin = PRBMathSD59x18Typed.add(

            PRBMath.SD59x18({
                value: trader.margin
            }),

            PRBMath.SD59x18({
                value: irsCashflow
            })
        ).value;

        trader.update(trader.notional, trader.fixedRate, 0, 0, updatedMargin, true);

    }   
    

    function fixedFactor(bool atMaturity) public returns(uint256) {

        
        uint256 timePeriodInSeconds;

        if (atMaturity) {
            uint256 termEndTimestamp = termStartTimestamp + (termInDays * 24 * 60 * 60);
            timePeriodInSeconds = termEndTimestamp - termStartTimestamp;
        } else {
            timePeriodInSeconds = _blockTimestamp() - termStartTimestamp;
        }    
        
        uint256 timePeriodInYears = calculator.accrualFact(timePeriodInSeconds);
        
        uint256 fixedFactorValue = PRBMathUD60x18Typed.mul(
                
                PRBMath.UD60x18({
                    value: timePeriodInYears
                }),
                
                PRBMath.UD60x18({
                    value: 10 ** 16
                })
        ).value;

        return fixedFactorValue;    

    }
    
    function variableFactor(bool atMaturity) public returns(uint256) {
        
        if (atMaturity) {
            
            // todo: require check that current timestamp is after or equal to the maturity date

            uint256 termEndTimestamp = termStartTimestamp + (termInDays * 24 * 60 * 60);
            (bool isSet,,) = rateOracle.rates(underlyingToken, termEndTimestamp);

            if(!isSet) {
                if (termEndTimestamp == _blockTimestamp()) {
                    rateOracle.updateRate(underlyingToken);
                } // else  raise an error        
            }

            uint256 rateFromPoolStartToMaturity = rateOracle.getRateFromTo(underlyingToken, termStartTimestamp, _blockTimestamp());
            
            rateFromPoolStartToMaturity = rateFromPoolStartToMaturity / 10 ** (27 - 18); // 18 decimals 

            return rateFromPoolStartToMaturity;
        
        } else {
            (bool isSet,,) = rateOracle.rates(underlyingToken, _blockTimestamp());

            if(!isSet) {
                rateOracle.updateRate(underlyingToken);
            }

            uint256 rateFromPoolStartToNow = rateOracle.getRateFromTo(underlyingToken, termStartTimestamp, _blockTimestamp());

            rateFromPoolStartToNow = rateFromPoolStartToNow / 10 ** (27 - 18); // 18 decimals 
            
            return rateFromPoolStartToNow;
        }        

    }
    

    function calculateFixedTokenBalance(int256 amount0, int256 excessBalance) public returns(int256 fixedTokenBalance) {

        PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: amount0
            }),

            PRBMath.SD59x18({
                value: int256(fixedFactor(true))
            })
        );

        PRBMath.SD59x18 memory numerator = PRBMathSD59x18Typed.sub(
            exp1,
            PRBMath.SD59x18({
                value: excessBalance
            })
        );

        
        fixedTokenBalance = PRBMathSD59x18Typed.div(
            exp1,
            PRBMath.SD59x18({
                value: int256(fixedFactor(true))
            })
        ).value;
        
    }
    
    
    function getFixedTokenBalance(uint256 amount0, uint256 amount1, bool isFT) public returns(int256 fixedTokenBalance) {
        
        int256 excessFixedAccruedBalance;
        int256 excessVariableAccruedBalance;
        int256 excessBalance;

        if (isFT) {

            PRBMath.SD59x18 memory excessFixedAccruedBalance = PRBMathSD59x18Typed.mul(

                PRBMath.SD59x18({
                    value: int256(amount0)
                }),

                PRBMath.SD59x18({
                    value: int256(fixedFactor(false))
                })
            );

            PRBMath.SD59x18 memory excessVariableAccruedBalance = PRBMathSD59x18Typed.mul(

                PRBMath.SD59x18({
                    value: -int256(amount1)
                }),

                PRBMath.SD59x18({
                    value: int256(variableFactor(false))
                })
            );


            excessBalance = PRBMathSD59x18Typed.add(
                excessFixedAccruedBalance,
                excessVariableAccruedBalance
            ).value;

            fixedTokenBalance = calculateFixedTokenBalance(int256(amount0), excessBalance);
        } else {
    
            PRBMath.SD59x18 memory excessFixedAccruedBalance = PRBMathSD59x18Typed.mul(

                PRBMath.SD59x18({
                    value: -int256(amount0)
                }),

                PRBMath.SD59x18({
                    value: int256(fixedFactor(false))
                })
            );

            PRBMath.SD59x18 memory excessVariableAccruedBalance = PRBMathSD59x18Typed.mul(

                PRBMath.SD59x18({
                    value: int256(amount1)
                }),

                PRBMath.SD59x18({
                    value: int256(variableFactor(false))
                })
            );

            
            excessBalance = PRBMathSD59x18Typed.add(
                excessFixedAccruedBalance,
                excessVariableAccruedBalance
            ).value;

            fixedTokenBalance = calculateFixedTokenBalance(-int256(amount0), excessBalance);

        }
  

    }


    function calculateIRSParams(uint256 amount0, uint256 amount1, bool isFT, bool isUnwind) public 
                noDelegateCall returns(int256 notional, uint256 fixedRate, int256 margin, int256 fixedTokenBalance, int256 variableTokenBalance) {

        PRBMath.UD60x18 memory notionalUD = PRBMath.UD60x18({value: uint256(amount1)});
        PRBMath.UD60x18 memory fixedRateUD = PRBMathUD60x18Typed.mul(
                                                    PRBMathUD60x18Typed.div(PRBMath.UD60x18({value: uint256(amount0)}), PRBMath.UD60x18({value: uint256(amount1)})),
                                                    PRBMath.UD60x18({value: 10**16})
                                                );
                                        

        // todo: include require checks in here (check how other protocols do date checks and tests)

        uint256 termEndTimeStamp = termStartTimestamp + (termInDays * 24 * 60 * 60);
        
        // compute margin, initiate the swap
        if (isFT) {

            // todo: only compute margin if it is not an unwind
            margin = int256(calculator.getFTMarginRequirement(notionalUD.value, fixedRateUD.value, termEndTimeStamp - _blockTimestamp(), false));
            notional = int256(notionalUD.value);

            variableTokenBalance = -int256(amount1);

        } else {

            margin = int256(calculator.getVTMarginRequirement(notionalUD.value, fixedRateUD.value, termEndTimeStamp - _blockTimestamp(), false));

            notional = -int256(notionalUD.value);

            variableTokenBalance = int256(amount1);
            
        }

        fixedTokenBalance = getFixedTokenBalance(amount0, amount1, isFT);
    
        fixedRate = fixedRateUD.value;

    }

    function swap(
        SwapParams memory params
        // bytes calldata data
    ) public override noDelegateCall returns (Trader.Info memory trader){
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
            blockTimestamp: _blockTimestamp()
        });

        bool exactInput = params.amountSpecified > 0;

        SwapState memory state = SwapState({
            amountSpecifiedRemaining: params.amountSpecified,
            amountCalculated: 0,
            sqrtPriceX96: slot0Start.sqrtPriceX96,
            tick: slot0Start.tick,
            feeGrowthGlobalX128: feeGrowthGlobalX128,
            liquidity: cache.liquidityStart,
            notionalGrowthGlobal: notionalGrowthGlobal,
            notionalGlobal: notionalGlobal,
            fixedRateGlobal: fixedRateGlobal,
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

            if (exactInput) {
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
                                value: getFixedTokenBalance(step.amount0, step.amount1, !params.isFT)
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
                                value: getFixedTokenBalance(step.amount0, step.amount1, params.isFT)
                            }),

                            PRBMath.SD59x18({
                                value: int256(uint256(state.liquidity))
                            })
                        )
                    ).value;

                } 
                
                int256 _notionalGlobalBefore = state.notionalGlobal;
                
                state.notionalGlobal = PRBMathSD59x18Typed.add(

                    PRBMath.SD59x18({
                            value: state.notionalGlobal
                        }),

                    PRBMath.SD59x18({
                        value: step.notionalAmount
                    })

                ).value;

                state.notionalGrowthGlobal = PRBMathSD59x18Typed.add(

                    PRBMath.SD59x18({
                            value: state.notionalGrowthGlobal
                    }),

                    PRBMathSD59x18Typed.div(
                        
                        PRBMath.SD59x18({
                            value: step.notionalAmount
                        }),

                        PRBMath.SD59x18({
                            value: int256(uint256(state.liquidity))
                        })
                    
                    )

                ).value;


                PRBMath.SD59x18 memory exp1UD = PRBMathSD59x18Typed.mul(

                    PRBMath.SD59x18({
                            value: step.fixedRate
                        }),

                    PRBMath.SD59x18({
                        value: state.notionalGlobal
                    })

                );

                PRBMath.SD59x18 memory exp2UD = PRBMathSD59x18Typed.mul(

                    PRBMathSD59x18Typed.sub(
                        
                        PRBMath.SD59x18({
                            value: step.fixedRate
                        }),

                        PRBMath.SD59x18({
                            value: state.fixedRateGlobal
                        })

                    ),

                    PRBMath.SD59x18({
                        value: _notionalGlobalBefore
                    })

                );

                PRBMath.SD59x18 memory numerator = PRBMathSD59x18Typed.sub(exp1UD, exp2UD);
            
                state.fixedRateGlobal = PRBMathSD59x18Typed.div(

                    numerator,

                    PRBMath.SD59x18({
                        value: state.notionalGlobal
                    })

                ).value;

            }


            // shift tick if we reached the next price
            if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
                // if the tick is initialized, run the tick transition
                if (step.initialized) {
                    // todo: tweak this
                    int128 liquidityNet = ticks.cross(
                        step.tickNext,
                        state.feeGrowthGlobalX128,
                        state.notionalGrowthGlobal,
                        state.notionalGlobal,
                        state.fixedRateGlobal,
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

        (int256 amount0, int256 amount1) = params.isFT == exactInput
            ? (
                params.amountSpecified - state.amountSpecifiedRemaining,
                state.amountCalculated
            )
            : (
                state.amountCalculated,
                params.amountSpecified - state.amountSpecifiedRemaining
            );

        feeGrowthGlobalX128 = state.feeGrowthGlobalX128;
        notionalGrowthGlobal = state.notionalGrowthGlobal;
        notionalGlobal = state.notionalGlobal;
        fixedRateGlobal = state.fixedRateGlobal;

        variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
        fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;
        
        InitiateIRSParams memory initiateIRSParams;

        (initiateIRSParams.notional, initiateIRSParams.fixedRate,
        initiateIRSParams.margin, initiateIRSParams.fixedTokenBalance, initiateIRSParams.variableTokenBalance) = calculateIRSParams(uint256(amount0), uint256(amount1), params.isFT, params.isUnwind);
        
        if (params.isUnwind) {
            initiateIRSParams.settled = true;
        }

        trader = _initiateIRS(
            initiateIRSParams
        );

        
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
