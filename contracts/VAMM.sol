// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IDeployer.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/TickBitmap.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";

import "./utils/SafeCast.sol";
import "./utils/LowGasSafeMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./core_libraries/SwapMath.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";


contract VAMM is IVAMM, Pausable {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;
  using SafeCast for uint256;
  using SafeCast for int256;
  using Tick for mapping(int24 => Tick.Info);
  using TickBitmap for mapping(int16 => uint256);

  uint256 public override fee;

  int24 public override tickSpacing;

  uint128 public override maxLiquidityPerTick;

  mapping(int24 => Tick.Info) public override ticks;
  mapping(int16 => uint256) public override tickBitmap;
  
  uint256 public constant SECONDS_IN_DAY_WAD = 86400 * 10**18;

  address public immutable override factory;

  bool public override unlocked;

  /// @dev Mutually exclusive reentrancy protection into the vamm to/from a method. This method also prevents entrance
  /// to a function before the vamm is initialized. The reentrancy guard is required throughout the contract.
  modifier lock() {
    require(unlocked, "LOK");
    unlocked = false;
    _;
    unlocked = true;
  }

  /// @dev Modifier that ensures that critical actions in the contract can only be done by the top-level factory owner
  modifier onlyFactoryOwner() {
    require(msg.sender == IFactory(factory).owner(), "only factory owner");
    _;
  }

  /// @dev Modifier that ensures new LP positions cannot be minted after one day before the maturity of the vamm
  modifier checkCurrentTimestampTermEndTimestampDelta() {
    uint256 currentTimestamp = Time.blockTimestampScaled(); 
    require(currentTimestamp < marginEngine.termEndTimestamp(), "amm hasn't reached maturity");
    uint256 timeDelta = marginEngine.termEndTimestamp() - currentTimestamp;
    require(timeDelta > SECONDS_IN_DAY_WAD, "amm must be 1 day past maturity");
    _;
  }

  constructor() Pausable() {
    address _marginEngineAddress;
    (
      _marginEngineAddress
    ) = IDeployer(msg.sender).vammParameters();

    marginEngine = IMarginEngine(_marginEngineAddress);
    factory = marginEngine.factory();
  }

  VAMMVars public override vammVars;

  int256 public override fixedTokenGrowthGlobal;

  int256 public override variableTokenGrowthGlobal;

  uint256 public override feeGrowthGlobal;

  uint128 public override liquidity;

  uint256 public override protocolFees;

  IMarginEngine public override marginEngine;

  function setMarginEngine(address _marginEngineAddress) external onlyFactoryOwner override {
    marginEngine = IMarginEngine(_marginEngineAddress);
  }


  function updateProtocolFees(uint256 protocolFeesCollected)
    external
    override
  {
    require(msg.sender==address(marginEngine), "only MarginEngine");
    if (protocolFees < protocolFeesCollected) {
      revert NotEnoughFunds(protocolFeesCollected, protocolFees);
    }
    protocolFees = protocolFees - protocolFeesCollected;
  }

  /// @dev not locked because it initializes unlocked
  function initialize(uint160 sqrtPriceX96) external override {
    if (vammVars.sqrtPriceX96 != 0)  {
      revert ExpectedSqrtPriceZeroBeforeInit(vammVars.sqrtPriceX96);
    }

    int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

    vammVars = VAMMVars({ sqrtPriceX96: sqrtPriceX96, tick: tick, feeProtocol: 0 });

    unlocked = true;

    emit Initialize(sqrtPriceX96, tick);
  }

  function setFeeProtocol(uint256 feeProtocol) external override onlyFactoryOwner lock {
    vammVars.feeProtocol = feeProtocol;
    // emit set fee protocol
  }

  function setTickSpacing(int24 _tickSpacing) external override onlyFactoryOwner {
    tickSpacing = _tickSpacing;
  }

  function setMaxLiquidityPerTick(uint128 _maxLiquidityPerTick) external override onlyFactoryOwner {
    maxLiquidityPerTick = _maxLiquidityPerTick;
  }

  function setFee(uint256 _fee) external override onlyFactoryOwner {
    fee = _fee;
  }

  function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override whenNotPaused lock {
    updatePosition(
      ModifyPositionParams({
        owner: msg.sender,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidityDelta: -int256(uint256(amount)).toInt128()
      })
    );

    marginEngine.unwindPosition(msg.sender, tickLower, tickUpper);
  }

  function flipTicks(ModifyPositionParams memory params)
    internal
    returns (bool flippedLower, bool flippedUpper)
  {
    flippedLower = ticks.update(
      params.tickLower,
      vammVars.tick,
      params.liquidityDelta,
      fixedTokenGrowthGlobal,
      variableTokenGrowthGlobal,
      feeGrowthGlobal,
      false,
      maxLiquidityPerTick
    );
    flippedUpper = ticks.update(
      params.tickUpper,
      vammVars.tick,
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
  
  
  function updatePosition(ModifyPositionParams memory params) private {

    Tick.checkTicks(params.tickLower, params.tickUpper);

    VAMMVars memory _vammVars = vammVars; // SLOAD for gas optimization

    UpdatePositionVars memory vars;

    /// @dev update the ticks if necessary
    if (params.liquidityDelta != 0) {
      (vars.flippedLower, vars.flippedUpper) = flipTicks(params);
    }

    vars.fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
      Tick.FixedTokenGrowthInsideParams({
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        tickCurrent: vammVars.tick,
        fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
      })
    );

    vars.variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
      Tick.VariableTokenGrowthInsideParams({
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        tickCurrent: vammVars.tick,
        variableTokenGrowthGlobal: variableTokenGrowthGlobal
      })
    );

    vars.feeGrowthInside = ticks.getFeeGrowthInside(
      params.tickLower,
      params.tickUpper,
      vammVars.tick,
      feeGrowthGlobal
    );

    marginEngine.updatePosition(params, vars);

    // clear any tick data that is no longer needed
    if (params.liquidityDelta < 0) {
      if (vars.flippedLower) {
        ticks.clear(params.tickLower);
      }
      if (vars.flippedUpper) {
        ticks.clear(params.tickUpper);
      }
    }

    marginEngine.rateOracle().writeOracleEntry();

    if (params.liquidityDelta != 0) {
      if (
        (_vammVars.tick >= params.tickLower) && (_vammVars.tick < params.tickUpper)
      ) {
        // current tick is inside the passed range
        uint128 liquidityBefore = liquidity; // SLOAD for gas optimization

        liquidity = LiquidityMath.addDelta(
          liquidityBefore,
          params.liquidityDelta
        );
      }
    }
  }
  
  /// @inheritdoc IVAMM
  function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) public override whenNotPaused checkCurrentTimestampTermEndTimestampDelta lock {
    // public avoids using callees for tests (timeout issue in vamm.ts)
    if (amount <= 0) {
      revert LiquidityDeltaMustBePositiveInMint(amount);
    }

    marginEngine.checkPositionMarginRequirementSatisfied(
      recipient,
      tickLower,
      tickUpper,
      amount
    );

    updatePosition(
      ModifyPositionParams({
        owner: recipient,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidityDelta: int256(uint256(amount)).toInt128()
      })
    );

    emit Mint(msg.sender, recipient, tickLower, tickUpper, amount);
  }


  /// @inheritdoc IVAMM
  function swap(SwapParams memory params)
    external
    override
    whenNotPaused
    checkCurrentTimestampTermEndTimestampDelta
    lock
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
  {
    /// @audit might be helpful to have a higher level function (initiateIRS) which then calls swap

    SwapLocalVars memory swapLocalVars;
    
    VAMMVars memory vammVarsStart = vammVars;

    checksBeforeSwap(params, vammVarsStart);

    /// @dev lock the vamm while the swap is taking place

    unlocked = false;


    /// @audit use uint32 for blockTimestamp (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L132)
    /// @audit feeProtocol can be represented in a more efficient way (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L69)
    // Uniswap implementation: feeProtocol: zeroForOne ? (slot0Start.feeProtocol % 16) : (slot0Start.feeProtocol >> 4), where in our case isFT == !zeroForOne
    SwapCache memory cache = SwapCache({
      liquidityStart: liquidity,
      blockTimestamp: Time.blockTimestampScaled(),
      feeProtocol: vammVars.feeProtocol
    });

    /// @dev amountSpecified = The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
    /// @dev Both FTs and VTs care about the notional of their IRS contract, the notional is the absolute amount of variableTokens traded
    /// @dev Hence, if an FT wishes to trade x notional, amountSpecified needs to be an exact input (in terms of the variableTokens they provide), hence amountSpecified needs to be positive
    /// @audit add revert statement if isFT and amountSpecified is not positive
    /// @dev Also, if a VT wishes to trade x notional, amountSpecified needs to be an exact output (in terms of the variableTokens they receive), hence amountSpecified needs to be negative 
    /// @audit add revert statement if isFT and amountSpecified is not positive
    /// @dev amountCalculated is the amount already swapped out/in of the output (variable taker) / input (fixed taker) asset

    SwapState memory state = SwapState({
      amountSpecifiedRemaining: params.amountSpecified,
      amountCalculated: 0,
      sqrtPriceX96: vammVarsStart.sqrtPriceX96,
      tick: vammVarsStart.tick,
      liquidity: cache.liquidityStart,
      fixedTokenGrowthGlobal: fixedTokenGrowthGlobal,
      variableTokenGrowthGlobal: variableTokenGrowthGlobal,
      feeGrowthGlobal: feeGrowthGlobal,
      protocolFee: 0
    });

    /// @dev write an entry to the rate oracle (given no throttling), should be a no-op

    marginEngine.rateOracle().writeOracleEntry();

    // continue swapping as long as we haven't used the entire input/output and haven't reached the price (implied fixed rate) limit
    while (
      state.amountSpecifiedRemaining != 0 &&
      state.sqrtPriceX96 != params.sqrtPriceLimitX96
    ) {
      StepComputations memory step;

      step.sqrtPriceStartX96 = state.sqrtPriceX96;


      /// @dev if isFT (fixed taker) (moving right to left), the nextInitializedTick should be more than or equal to the current tick
      /// @dev if !isFT (variable taker) (moving left to right), the nextInitializedTick should be less than or equal to the current tick
      /// @audit add an assert statement that checks for the above two conditions
      (step.tickNext, step.initialized) = tickBitmap
        .nextInitializedTickWithinOneWord(state.tick, tickSpacing, !params.isFT);

      // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      // get the price for the next tick
      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

      // compute values to swap to the target tick, price limit, or point where input/output amount is exhausted
      /// @dev for a Fixed Taker (isFT) if the sqrtPriceNextX96 is larger than the limit, then the target price passed into computeSwapStep is sqrtPriceLimitX96
      /// @dev for a Variable Taker (!isFT) if the sqrtPriceNextX96 is lower than the limit, then the target price passed into computeSwapStep is sqrtPriceLimitX96
      (
        state.sqrtPriceX96,
        step.amountIn,
        step.amountOut,
        step.feeAmount
      ) = SwapMath.computeSwapStep(
        state.sqrtPriceX96,
        (
          !params.isFT
            ? step.sqrtPriceNextX96 < params.sqrtPriceLimitX96
            : step.sqrtPriceNextX96 > params.sqrtPriceLimitX96
        )
          ? params.sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        fee,
        marginEngine.termEndTimestamp() - Time.blockTimestampScaled()
      );

      if (params.amountSpecified > 0) {
        // exact input
        state.amountSpecifiedRemaining -= (step.amountIn).toInt256();
        state.amountCalculated = state.amountCalculated.sub(
          (step.amountOut).toInt256()
        );
      } else {
        // prb math is not used in here
        state.amountSpecifiedRemaining += step.amountOut.toInt256();
        state.amountCalculated = state.amountCalculated.add(
          (step.amountIn).toInt256()
        );
      }

      // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
      if (cache.feeProtocol > 0) {
        step.feeProtocolDelta = PRBMathUD60x18.mul(step.feeAmount, cache.feeProtocol); // as a percentage of LP fees
        step.feeAmount = step.feeAmount - step.feeProtocolDelta;
        state.protocolFee = state.protocolFee + step.feeProtocolDelta;
      }

      // update global fee tracker
      if (state.liquidity > 0) {
        uint256 variableFactor = marginEngine.rateOracle().variableFactor(
          marginEngine.termStartTimestamp(),
          marginEngine.termEndTimestamp()
        );
        (
          state.feeGrowthGlobal,
          state.variableTokenGrowthGlobal,
          state.fixedTokenGrowthGlobal
        ) = calculateUpdatedGlobalTrackerValues(
          params,
          state,
          step,
          variableFactor,
          marginEngine.termStartTimestamp(),
          marginEngine.termEndTimestamp()
        );
      }

      // shift tick if we reached the next price
      if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
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

    if (state.tick != vammVarsStart.tick) {
      vammVars.sqrtPriceX96 = state.sqrtPriceX96;
      vammVars.tick = state.tick;
    } else {
      vammVars.sqrtPriceX96 = state.sqrtPriceX96;
    }

    // update liquidity if it changed
    if (cache.liquidityStart != state.liquidity) liquidity = state.liquidity;
    feeGrowthGlobal = state.feeGrowthGlobal;
    variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
    fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;

    if (state.protocolFee > 0) {
      protocolFees = protocolFees + state.protocolFee;
    }

    (swapLocalVars.amount0Int, swapLocalVars.amount1Int) = params.isFT ==
      params.amountSpecified > 0
      ? (
        params.amountSpecified - state.amountSpecifiedRemaining,
        state.amountCalculated
      )
      : (
        state.amountCalculated,
        params.amountSpecified - state.amountSpecifiedRemaining
      );

    /// feels redundunt
    swapLocalVars.amount0;
    swapLocalVars.amount1;

    if (swapLocalVars.amount0Int > 0) {
      if (swapLocalVars.amount1Int >= 0) {
        revert ExpectedOppositeSigns(swapLocalVars.amount0Int, swapLocalVars.amount1Int);
      } 
      swapLocalVars.amount0 = uint256(swapLocalVars.amount0Int);
      swapLocalVars.amount1 = uint256(-swapLocalVars.amount1Int);
    } else if (swapLocalVars.amount1Int > 0) {
      if (swapLocalVars.amount0Int >= 0) {
        revert ExpectedOppositeSigns(swapLocalVars.amount0Int, swapLocalVars.amount1Int);
      } 
      swapLocalVars.amount0 = uint256(-swapLocalVars.amount0Int);
      swapLocalVars.amount1 = uint256(swapLocalVars.amount1Int);
    }

    if (params.isFT) {
      _variableTokenDelta = -int256(swapLocalVars.amount1);
      _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
        int256(swapLocalVars.amount0),
        -int256(swapLocalVars.amount1),
        marginEngine.rateOracle().variableFactor(
          marginEngine.termStartTimestamp(),
          marginEngine.termEndTimestamp()
        ),
        marginEngine.termStartTimestamp(),
        marginEngine.termEndTimestamp()
      );
    } else {
      _variableTokenDelta = int256(swapLocalVars.amount1);
      _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
        -int256(swapLocalVars.amount0),
        int256(swapLocalVars.amount1),
        marginEngine.rateOracle().variableFactor(
          marginEngine.termStartTimestamp(),
          marginEngine.termEndTimestamp()
        ),
        marginEngine.termStartTimestamp(),
        marginEngine.termEndTimestamp()
      );
    }

    // if this is not the case then it is a position unwind induced swap triggered by a position liquidation  which is handled in the position unwind function
    // maybe would be cleaner to use callbacks like Uniswap v3?
    if (params.isTrader) {
      marginEngine.updateTraderBalances(
        params.recipient,
        _fixedTokenDelta,
        _variableTokenDelta,
        params.isUnwind
      );
    }

    emit Swap(
      msg.sender,
      params.recipient,
      state.sqrtPriceX96,
      state.liquidity,
      state.tick
    );

    unlocked = true;
  }

  /// @inheritdoc IVAMM
  function computePositionFixedAndVariableGrowthInside(
    int24 tickLower,
    int24 tickUpper,
    int24 currentTick
  )
    external
    view
    override
    returns (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside)
  {
    fixedTokenGrowthInside = ticks.getFixedTokenGrowthInside(
      Tick.FixedTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: currentTick,
        fixedTokenGrowthGlobal: fixedTokenGrowthGlobal
      })
    );

    variableTokenGrowthInside = ticks.getVariableTokenGrowthInside(
      Tick.VariableTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: currentTick,
        variableTokenGrowthGlobal: variableTokenGrowthGlobal
      })
    );
  }

  function checksBeforeSwap(
      SwapParams memory params,
      VAMMVars memory vammVarsStart
  ) internal view {
      
      if (params.amountSpecified == 0) {
          revert IRSNotionalAmountSpecifiedMustBeNonZero(
              params.amountSpecified
          );
      }

      if (!unlocked) {
          revert CanOnlyTradeIfUnlocked(unlocked);
      }

      /// @dev if a trader is an FT, they consume fixed in return for variable
      /// @dev Movement from right to left along the VAMM, hence the sqrtPriceLimitX96 needs to be higher than the current sqrtPriceX96, but lower than the MAX_SQRT_RATIO
      /// @dev if a trader is a VT, they consume variable in return for fixed
      /// @dev Movement from left to right along the VAMM, hence the sqrtPriceLimitX96 needs to be lower than the current sqrtPriceX96, but higher than the MIN_SQRT_RATIO

      require(
          params.isFT
              ? params.sqrtPriceLimitX96 > vammVarsStart.sqrtPriceX96 &&
                  params.sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
              : params.sqrtPriceLimitX96 < vammVarsStart.sqrtPriceX96 &&
                  params.sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,
          "SPL"
      );
  }


    function calculateUpdatedGlobalTrackerValues(
        IVAMM.SwapParams memory params,
        IVAMM.SwapState memory state,
        IVAMM.StepComputations memory step,
        uint256 variableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    )
        internal
        view
        returns (
            uint256 stateFeeGrowthGlobal,
            int256 stateVariableTokenGrowthGlobal,
            int256 stateFixedTokenGrowthGlobal
        )
    {
        stateFeeGrowthGlobal =
            state.feeGrowthGlobal +
            PRBMathUD60x18.div(step.feeAmount, uint256(state.liquidity));

        if (params.isFT) {
            stateVariableTokenGrowthGlobal =
                state.variableTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    int256(step.amountOut),
                    int256(uint256(state.liquidity))
                );

            // check the signs
            stateFixedTokenGrowthGlobal =
                state.fixedTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    FixedAndVariableMath.getFixedTokenBalance(
                        -int256(step.amountIn),
                        int256(step.amountOut),
                        variableFactor,
                        termStartTimestamp,
                        termEndTimestamp
                    ),
                    int256(uint256(state.liquidity))
                );
        } else {
            // check the signs are correct
            stateVariableTokenGrowthGlobal =
                state.variableTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    -int256(step.amountIn),
                    int256(uint256(state.liquidity))
                );

            stateFixedTokenGrowthGlobal =
                state.fixedTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    FixedAndVariableMath.getFixedTokenBalance(
                        int256(step.amountOut),
                        -int256(step.amountIn),
                        variableFactor,
                        termStartTimestamp,
                        termEndTimestamp
                    ), // variable factor maturity false
                    int256(uint256(state.liquidity))
                );
        }
    }

}