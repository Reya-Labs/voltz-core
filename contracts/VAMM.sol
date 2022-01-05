// SPDX-License-Identifier: MIT

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

import "./interfaces/IMarginCalculator.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";

import "./core_libraries/UnwindTraderUnwindPosition.sol";
import "./core_libraries/VAMMHelpers.sol";
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
    require(currentTimestamp < amm.termEndTimestamp(), "amm hasn't reached maturity");
    uint256 timeDelta = amm.termEndTimestamp() - currentTimestamp;
    require(timeDelta > SECONDS_IN_DAY_WAD, "amm must be 1 day past maturity");
    _;
  }

  constructor() Pausable() {
    address _ammAddress;
    (
      _ammAddress
    ) = IDeployer(msg.sender).vammParameters();

    amm = IAMM(_ammAddress);
    factory = amm.factory();
  }

  VAMMVars public override vammVars;

  int256 public override fixedTokenGrowthGlobal;

  int256 public override variableTokenGrowthGlobal;

  uint256 public override feeGrowthGlobal;

  uint128 public override liquidity;

  uint256 public override protocolFees;

  IAMM public override amm;

  function setAMM(address _ammAddress) external onlyFactoryOwner override {
    amm = IAMM(_ammAddress);
  }


  function updateProtocolFees(uint256 protocolFeesCollected)
    external
    override
  {
    require(msg.sender==address(amm), "only AMM");
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

    amm.marginEngine().unwindPosition(msg.sender, tickLower, tickUpper);
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

    amm.marginEngine().updatePosition(params, vars);

    // clear any tick data that is no longer needed
    if (params.liquidityDelta < 0) {
      if (vars.flippedLower) {
        ticks.clear(params.tickLower);
      }
      if (vars.flippedUpper) {
        ticks.clear(params.tickUpper);
      }
    }

    amm.rateOracle().writeOracleEntry();

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

    amm.marginEngine().checkPositionMarginRequirementSatisfied(
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

    SwapLocalVars memory swapLocalVars;
    
    VAMMVars memory vammVarsStart = vammVars;

    VAMMHelpers.checksBeforeSwap(params, vammVarsStart, !unlocked);

    unlocked = false;

    SwapCache memory cache = SwapCache({
      liquidityStart: liquidity,
      blockTimestamp: Time.blockTimestampScaled(),
      feeProtocol: vammVars.feeProtocol
    });

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

    amm.rateOracle().writeOracleEntry();

    // continue swapping as long as we haven't used the entire input/output and haven't reached the price (implied fixed rate) limit
    while (
      state.amountSpecifiedRemaining != 0 &&
      state.sqrtPriceX96 != params.sqrtPriceLimitX96
    ) {
      StepComputations memory step;

      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      (step.tickNext, step.initialized) = tickBitmap
        .nextInitializedTickWithinOneWord(state.tick, tickSpacing, params.isFT);

      // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
      } else if (step.tickNext > TickMath.MAX_TICK) {
        step.tickNext = TickMath.MAX_TICK;
      }

      // get the price for the next tick
      step.sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(step.tickNext);

      // compute values to swap to the target tick, price limit, or point where input/output amount is exhausted
      (
        state.sqrtPriceX96,
        step.amountIn,
        step.amountOut,
        step.feeAmount
      ) = SwapMath.computeSwapStep(
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
        amm.termEndTimestamp() - Time.blockTimestampScaled()
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
        // uint256 delta = PRBMathUD60x18.mul(step.feeAmount, cache.feeProtocol); // as a percentage of LP fees
        step.feeAmount = step.feeAmount - (PRBMathUD60x18.mul(step.feeAmount, cache.feeProtocol));
        state.protocolFee = state.protocolFee + (PRBMathUD60x18.mul(step.feeAmount, cache.feeProtocol));
      }

      // update global fee tracker
      if (state.liquidity > 0) {
        uint256 variableFactor = amm.rateOracle().variableFactor(
          amm.termStartTimestamp(),
          amm.termEndTimestamp()
        );
        (
          state.feeGrowthGlobal,
          state.variableTokenGrowthGlobal,
          state.fixedTokenGrowthGlobal
        ) = VAMMHelpers.calculateUpdatedGlobalTrackerValues(
          params,
          state,
          step,
          variableFactor,
          amm.termStartTimestamp(),
          amm.termEndTimestamp()
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
        amm.rateOracle().variableFactor(
          amm.termStartTimestamp(),
          amm.termEndTimestamp()
        ),
        amm.termStartTimestamp(),
        amm.termEndTimestamp()
      );
    } else {
      _variableTokenDelta = int256(swapLocalVars.amount1);
      _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
        -int256(swapLocalVars.amount0),
        int256(swapLocalVars.amount1),
        amm.rateOracle().variableFactor(
          amm.termStartTimestamp(),
          amm.termEndTimestamp()
        ),
        amm.termStartTimestamp(),
        amm.termEndTimestamp()
      );
    }

    // if this is not the case then it is a position unwind induced swap triggered by a position liquidation  which is handled in the position unwind function
    // maybe would be cleaner to use callbacks like Uniswap v3?
    if (params.isTrader) {
      amm.marginEngine().updateTraderBalances(
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
}