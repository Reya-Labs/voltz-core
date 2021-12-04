// SPDX-License-Identifier: BUSL-1.1

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
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IAMMFactory.sol";

import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "@openzeppelin/contracts/security/Pausable.sol";

// todo: factoryOwner is the treasury, don't need a separate treasury address

contract AMM is IAMM, NoDelegateCall, Pausable {
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

    address public override factory; // todo: make immutable

    address public immutable override underlyingToken;

    bytes32 public override rateOracleId; // todo: make immutable

    uint256 public immutable override termEndTimestamp;

    uint256 public immutable override termStartTimestamp;

    uint256 public immutable override fee; // 0.3%=0.003 of the total notional

    uint256 public constant LIQUIDATOR_REWARD = 2 * 10**15; // 0.2%=0.002 of the total margin (or remaining?)

    int24 public immutable override tickSpacing;

    uint128 public immutable override maxLiquidityPerTick;

    int256 public override fixedTokenGrowthGlobal;

    int256 public override variableTokenGrowthGlobal;

    IMarginCalculator public override calculator;
    
    IRateOracle public override rateOracle;

    constructor() Pausable() {

        int24 _tickSpacing;
        (
            factory,
            underlyingToken,
            rateOracleId, // todo: underlyingPool everywhere else, refactor
            termStartTimestamp,
            termEndTimestamp,
            fee,
            _tickSpacing
        ) = IAMMDeployer(msg.sender).parameters();
        tickSpacing = _tickSpacing;
        maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(
            _tickSpacing
        );
        
        address rateOracleAddress = IAMMFactory(factory).getRateOracleAddress(rateOracleId);

        rateOracle = IRateOracle(rateOracleAddress);

        address calculatorAddress = IAMMFactory(factory).calculator();
        
        calculator = IMarginCalculator(calculatorAddress);
    }

    struct Slot0 {
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;

        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        uint256 feeProtocol;

        // whether the pool is locked
        bool unlocked;
    }

    Slot0 public override slot0;

    uint256 public override feeGrowthGlobal;

    uint256 protocolFees;

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
    
    modifier onlyTreasury() {
        require(msg.sender == IAMMFactory(factory).treasury());
        _;
    }
    
    modifier onlyFactoryOwner() {
        require(msg.sender == IAMMFactory(factory).owner());
        _;
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

        slot0 = Slot0({sqrtPriceX96: sqrtPriceX96, tick: tick, feeProtocol: 0, unlocked: true});

        emit Initialize(sqrtPriceX96, tick);
    }

    
    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external {

        require(params.owner == msg.sender, "only the position owner can update the position margin");

        require(marginDelta!=0, "delta cannot be zero");

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 updatedMargin = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: position.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;

        if (FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp) {
            require(updatedMargin > 0, "Cannot withdraw more margin than you have");
        } else {

            IMarginCalculator.PositionMarginRequirementParams memory marginReqParams;

            (marginReqParams.owner, marginReqParams.tickLower, marginReqParams.tickUpper, marginReqParams.isLM) = (params.owner, params.tickLower, params.tickUpper, false);
            
            marginReqParams.rateOracleId = rateOracleId;
            marginReqParams.twapApy = rateOracle.getTwapApy(underlyingToken);

            int256 positionMarginRequirement =  int256(calculator.getPositionMarginRequirement(marginReqParams));             

            require(updatedMargin > positionMarginRequirement, "Cannot withdraw more margin than the minimum requirement");

        }

        position.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(underlyingToken).transferFrom(params.owner, address(this), uint256(marginDelta));
        } else {
            IERC20Minimal(underlyingToken).transferFrom(address(this), params.owner, uint256(-marginDelta));
        }

    }

    function updateTraderMargin(address recipient, int256 marginDelta) external {

        require(marginDelta!=0, "delta cannot be zero");
        require(recipient == msg.sender, "only the trader can update the margin");

        /*  
            todo: each trader as their own termEndTimestamp
            If current timestamp is beyond the term end timestamp, the trader should be able to withdraw all of the margin from the contract
            If current timestamp is within the term of the amm, the trader should be able to only withdraw up to the maintenance margin requirement
        */
        
        Trader.Info storage trader = traders.get(recipient);

        int256 updatedMargin = PRBMathSD59x18Typed.add(
            PRBMath.SD59x18({value: trader.margin}),
            PRBMath.SD59x18({value: marginDelta})
        ).value;
        
    
        if (FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp) {
    
            require(updatedMargin > 0, "Cannot withdraw more margin than you have");

        } else {
    
            int256 traderMarginRequirement = int256(calculator.getTraderMarginRequirement(
                IMarginCalculator.TraderMarginRequirementParams({
                        fixedTokenBalance: trader.fixedTokenBalance,
                        variableTokenBalance: trader.variableTokenBalance,
                        termStartTimestamp:termStartTimestamp,
                        termEndTimestamp:termEndTimestamp,
                        isLM: false,
                        rateOracleId: rateOracleId,
                        twapApy: rateOracle.getTwapApy(underlyingToken)
                    })
            ));                

            require(updatedMargin > traderMarginRequirement, "Cannot withdraw more margin than the minimum requirement");
    
        }

        trader.updateMargin(marginDelta);

        if (marginDelta > 0) {
            IERC20Minimal(underlyingToken).transferFrom(recipient, address(this), uint256(marginDelta));
        } else {
            IERC20Minimal(underlyingToken).transferFrom(address(this), recipient, uint256(-marginDelta));
        }

    }
    
    function settlePosition(ModifyPositionParams memory params) external {

        require(FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp, "A Position cannot settle before maturity");
        checkTicks(params.tickLower, params.tickUpper);

        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 fixedTokenDelta;
        int256 variableTokenDelta;

        int256 fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
            }) 
        );

        int256 variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                variableTokenGrowthGlobal: variableTokenGrowthGlobal
            })
        );

        (fixedTokenDelta, variableTokenDelta) = position.calculateFixedAndVariableDelta(fixedTokenGrowthInside, variableTokenGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(position.fixedTokenBalance, position.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(true, underlyingToken, termStartTimestamp, termEndTimestamp));

        position.updateBalances(-position.fixedTokenBalance, -position.variableTokenBalance);
        position.updateMargin(settlementCashflow);

    }
    
    function settleTrader(address recipient) public override  {

        require(FixedAndVariableMath.blockTimestampScaled() >= termEndTimestamp, "A Trader cannot settle before maturity");
        Trader.Info storage trader = traders.get(recipient);        
        int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, termStartTimestamp, termEndTimestamp, rateOracle.variableFactor(true, underlyingToken, termStartTimestamp, termEndTimestamp));

        trader.updateBalances(-trader.fixedTokenBalance, -trader.variableTokenBalance);
        trader.updateMargin(settlementCashflow);
    }
    
    function liquidatePosition(ModifyPositionParams memory params) whenNotPaused external {

        Position.Info storage position = positions.get(params.owner, params.tickLower, params.tickUpper);  

        int256 fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
            Tick.FixedTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
            }) 
        );

        int256 variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
            Tick.VariableTokenGrowthInsideParams({
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                tickCurrent: slot0.tick,
                variableTokenGrowthGlobal: variableTokenGrowthGlobal
            })
        );

        position.updateFixedAndVariableTokenGrowthInside(fixedTokenGrowthInside, variableTokenGrowthInside);

        bool isLiquidatable = calculator.isLiquidatablePosition(
            IMarginCalculator.PositionMarginRequirementParams({
                owner: params.owner,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                isLM: true,
                currentTick: slot0.tick,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                liquidity: position.liquidity,
                fixedTokenBalance: position.fixedTokenBalance,
                variableTokenBalance: position.variableTokenBalance,
                variableFactor: rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp),
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            }),
            position.margin
        );


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
    function liquidateTrader(LiquidateTraderParams memory params) whenNotPaused external {
        
        Trader.Info storage trader = traders.get(params.traderAddress);
            
        bool isLiquidatable = calculator.isLiquidatableTrader(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp: termStartTimestamp,
                termEndTimestamp: termEndTimestamp,
                isLM: true,
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            }),
            trader.margin
        );

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
    ) internal {

        // Trader.Info storage trader = traders.get(traderAddress);

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
    ) internal {
        
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        // check if the position needs to be unwound in the first place (check if the variable token balance is nonzero)

        checkTicks(tickLower, tickUpper);


        // todo: rename slot0 (takes up more slots now)
        Slot0 memory _slot0 = slot0; // SLOAD for gas optimization

        ModifyPositionParams memory modifyPositionparams;

        modifyPositionparams.owner = owner;
        modifyPositionparams.tickLower = tickLower;
        modifyPositionparams.tickUpper = tickUpper;
        modifyPositionparams.liquidityDelta = 0;

        // update the position
        _updatePosition(modifyPositionparams);

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
    
    // todo: can be migrated into the Position.sol contract (settlePosition function draft in earlier commits)
    
    // todo make the function private
    function _updatePosition(
        ModifyPositionParams memory params
    )
        internal
        returns (
            Position.Info storage position
        )
    {
        position = positions.get(params.owner, params.tickLower, params.tickUpper);

        uint256 _feeGrowthGlobal = feeGrowthGlobal;

        UpdatePositionVars memory vars;

        // if we need to update the ticks, do it
        if (params.liquidityDelta != 0) {
            vars.flippedLower = ticks.update(
                params.tickLower,
                slot0.tick,
                params.liquidityDelta,
                fixedTokenGrowthGlobal,
                variableTokenGrowthGlobal,
                feeGrowthGlobal,
                false,
                maxLiquidityPerTick
            );
            vars.flippedUpper = ticks.update(
                params.tickUpper,
                slot0.tick,
                params.liquidityDelta,
                fixedTokenGrowthGlobal,
                variableTokenGrowthGlobal,
                feeGrowthGlobal,
                true,
                maxLiquidityPerTick
            );

            if (vars.flippedLower) {
                tickBitmap.flipTick(params.tickLower, tickSpacing);
            }
            if (vars.flippedUpper) {
                tickBitmap.flipTick(params.tickUpper, tickSpacing);
            }
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

        
        // todo: some of the below can be simplified into another function (repeated in the settlement logic)
        position.updateLiquidity(params.liquidityDelta);
        (int256 fixedTokenDelta, int256 variableTokenDelta) = position.calculateFixedAndVariableDelta(vars.fixedTokenGrowthInside, vars.variableTokenGrowthInside);
        uint256 feeDelta = position.calculateFeeDelta(vars.feeGrowthInside);
        position.updateBalances(fixedTokenDelta, variableTokenDelta);
        position.updateMargin(int256(feeDelta));
        position.updateFixedAndVariableTokenGrowthInside(vars.fixedTokenGrowthInside, vars.variableTokenGrowthInside);
        position.updateFeeGrowthInside(vars.feeGrowthInside);

        // clear any tick data that is no longer needed
        if (params.liquidityDelta < 0) {
            if (vars.flippedLower) {
                ticks.clear(params.tickLower);
            }
            if (vars.flippedUpper) {
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

        position = _updatePosition(params);

        rateOracle.writeOrcleEntry(underlyingToken);

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
        uint128 amount
    ) external override lock whenNotPaused {
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

        Slot0 memory _slot0 = slot0;

        IMarginCalculator.PositionMarginRequirementParams memory marginReqParams;

        (marginReqParams.owner, marginReqParams.tickLower, marginReqParams.tickUpper, marginReqParams.isLM) = (recipient, tickLower, tickUpper, false);

        marginReqParams.rateOracleId = rateOracleId;
        marginReqParams.twapApy = rateOracle.getTwapApy(underlyingToken);

        int256 margin = int256(calculator.getPositionMarginRequirement(marginReqParams));

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
    
    function updateTrader(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance, int256 additionalMargin) public {

        Trader.Info storage trader = traders.get(recipient);
        trader.updateBalances(fixedTokenBalance, variableTokenBalance);
        

        int256 margin = int256(calculator.getTraderMarginRequirement(
            IMarginCalculator.TraderMarginRequirementParams({
                fixedTokenBalance: trader.fixedTokenBalance,
                variableTokenBalance: trader.variableTokenBalance,
                termStartTimestamp:termStartTimestamp,
                termEndTimestamp:termEndTimestamp,
                isLM: false,
                rateOracleId: rateOracleId,
                twapApy: rateOracle.getTwapApy(underlyingToken)
            })
        ));

        int256 proposedMargin = PRBMathSD59x18Typed.mul(

            PRBMath.SD59x18({
                value: additionalMargin
            }),

            PRBMath.SD59x18({
                value: trader.margin
            })

        ).value;

        if (proposedMargin >= margin)  {
            
            if (additionalMargin > 0) {
                IERC20Minimal(underlyingToken).transferFrom(recipient, address(this), uint256(additionalMargin));
                trader.updateMargin(additionalMargin);
            } else if (additionalMargin < 0) {
                IERC20Minimal(underlyingToken).transferFrom(address(this), recipient, uint256(-additionalMargin));
                trader.updateMargin(additionalMargin);
            }
            
        } else {
            
            int256 marginDelta = PRBMathSD59x18Typed.sub(

                PRBMath.SD59x18({
                    value: margin
                }),

                PRBMath.SD59x18({
                    value: proposedMargin
                })

            ).value;

            
            // todo: account for the scenario where the insurance fund is depleted?
            // v2 --> automatic circuit breaks that pause the amm in exceptional circumstances
            IERC20Minimal(underlyingToken).transferFrom(IAMMFactory(factory).insuranceFund(), address(this), uint256(marginDelta));

            trader.updateMargin(-trader.margin);
        }

    }
    
    // todo: more swap params in the struct
    function swap(
        SwapParams memory params
    ) public override noDelegateCall whenNotPaused returns (int256 _fixedTokenBalance, int256 _variableTokenBalance){
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

        rateOracle.writeOrcleEntry(underlyingToken);

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

            // todo: create a helper function
            uint256 timeToMaturityInSeconds = PRBMathUD60x18Typed.sub(
                    
                PRBMath.UD60x18({
                    value: termEndTimestamp
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
                state.amountSpecifiedRemaining += step.amountOut.toInt256();
                state.amountCalculated = state.amountCalculated.add(
                    (step.amountIn).toInt256()
                );
            }

            // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
            if (cache.feeProtocol > 0) {
                // uint256 delta = step.feeAmount / cache.feeProtocol;

                uint256 delta = PRBMathUD60x18Typed.mul(
                    
                    PRBMath.UD60x18({
                        value: step.feeAmount
                    }),

                    PRBMath.UD60x18({
                        value: cache.feeProtocol // as a percentage of LP fees
                    })
                ).value;

                step.feeAmount = PRBMathUD60x18Typed.sub(
                    
                    PRBMath.UD60x18({
                        value: step.feeAmount
                    }),

                    PRBMath.UD60x18({
                        value: delta
                    })
                
                ).value;

                state.protocolFee = PRBMathUD60x18Typed.add(
                    
                    PRBMath.UD60x18({
                        value: state.protocolFee
                    }),

                    PRBMath.UD60x18({
                        value: delta
                    })
                
                ).value;
            }

            // update global fee tracker
            if (state.liquidity > 0) {

                state.feeGrowthGlobal = PRBMathUD60x18Typed.add(

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
                    // then the AMM is a VT

                    state.variableTokenGrowthGlobal = PRBMathSD59x18Typed.add(

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

                    state.fixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                        PRBMath.SD59x18({
                            value: state.fixedTokenGrowthGlobal
                        }),

                        PRBMathSD59x18Typed.div(

                            PRBMath.SD59x18({
                                // todo: check the signs
                                value: FixedAndVariableMath.getFixedTokenBalance(-int256(step.amountIn), int256(step.amountOut), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)
                            }),

                            PRBMath.SD59x18({
                                value: int256(uint256(state.liquidity))
                            })
                        )
                    ).value;

                } else {
                    // then the AMM is an FT
                    
                    state.variableTokenGrowthGlobal = PRBMathSD59x18Typed.add(

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

                    state.fixedTokenGrowthGlobal = PRBMathSD59x18Typed.add(

                        PRBMath.SD59x18({
                            value: state.fixedTokenGrowthGlobal
                        }),

                        PRBMathSD59x18Typed.div(

                            PRBMath.SD59x18({
                                // todo: check the signs are correct
                                value: FixedAndVariableMath.getFixedTokenBalance(int256(step.amountOut), -int256(step.amountIn), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp)
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

        variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
        fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;
        

        if (params.isFT) {
            _variableTokenBalance = -int256(amount1);
            _fixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(int256(amount0), -int256(amount1), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp);
        } else {
            _variableTokenBalance = int256(amount1);
            _fixedTokenBalance = FixedAndVariableMath.getFixedTokenBalance(-int256(amount0), int256(amount1), rateOracle.variableFactor(false, underlyingToken, termStartTimestamp, termEndTimestamp), termStartTimestamp, termEndTimestamp);
        }

        if (params.isTrader) {
            updateTrader(params.recipient, _fixedTokenBalance, _variableTokenBalance, params.proposedMargin);
        }
        
        emit Swap(
            msg.sender,
            params.recipient,
            state.sqrtPriceX96,
            state.liquidity,
            state.tick
        );

        slot0.unlocked = true;
    }

    function setFeeProtocol(uint256 feeProtocol) external lock override onlyFactoryOwner  {
        // todo: introduce checks
        slot0.feeProtocol = feeProtocol;
        // todo: emit set fee protocol
    }

    function collectProtocol(
        address recipient,
        uint256 amountRequested
    ) external lock override onlyFactoryOwner returns (uint256 amount){

        amount = amountRequested > protocolFees ? protocolFees : amountRequested;

        if (amount > 0) {
            protocolFees -= amount;
            IERC20Minimal(underlyingToken).transferFrom(address(this), recipient, amount);
        }

        // todo: emit collect protocol event
    }


}
