// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
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
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VAMM is IVAMM, Pausable, Initializable, Ownable {
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

  bool public override unlocked;

  address private deployer;

  IRateOracle internal rateOracle;

  /// @dev Mutually exclusive reentrancy protection into the vamm to/from a method. This method also prevents entrance
  /// to a function before the vamm is initialized. The reentrancy guard is required throughout the contract.
  modifier lock() {
    require(unlocked, "LOK");
    unlocked = false;
    _;
    unlocked = true;
  }

  /// @dev Modifier that ensures new LP positions cannot be minted after one day before the maturity of the vamm
  modifier checkCurrentTimestampTermEndTimestampDelta() {
    uint256 currentTimestamp = Time.blockTimestampScaled(); 
    require(currentTimestamp < IMarginEngine(marginEngineAddress).termEndTimestamp(), "amm hasn't reached maturity");
    uint256 timeDelta = IMarginEngine(marginEngineAddress).termEndTimestamp() - currentTimestamp;
    require(timeDelta > SECONDS_IN_DAY_WAD, "amm must be 1 day past maturity");
    _;
  }

  constructor () Pausable() {
    deployer = msg.sender;
  }

  function initialize(address _marginEngineAddress) public initializer {
    require(_marginEngineAddress != address(0), "ME must be set");
    marginEngineAddress = _marginEngineAddress;
    address rateOracleAddress = IMarginEngine(marginEngineAddress).rateOracleAddress();
    rateOracle = IRateOracle(rateOracleAddress);
  }

  VAMMVars public override vammVars;

  int256 public override fixedTokenGrowthGlobal;

  int256 public override variableTokenGrowthGlobal;

  uint256 public override feeGrowthGlobal;

  uint128 public override liquidity;

  uint256 public override protocolFees;

  address public override marginEngineAddress;

  function updateProtocolFees(uint256 protocolFeesCollected)
    external
    override
  {
    require(msg.sender==marginEngineAddress, "only MarginEngine");
    if (protocolFees < protocolFeesCollected) {
      revert NotEnoughFunds(protocolFeesCollected, protocolFees);
    }
    protocolFees = protocolFees - protocolFeesCollected;
  }

  /// @dev not locked because it initializes unlocked
  function initializeVAMM(uint160 sqrtPriceX96) external override {
    if (vammVars.sqrtPriceX96 != 0)  {
      revert ExpectedSqrtPriceZeroBeforeInit(vammVars.sqrtPriceX96);
    }

    int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

    vammVars = VAMMVars({ sqrtPriceX96: sqrtPriceX96, tick: tick, feeProtocol: 0 });

    unlocked = true;

    emit Initialize(sqrtPriceX96, tick);
  }

  function setFeeProtocol(uint256 feeProtocol) external override onlyOwner lock {
    vammVars.feeProtocol = feeProtocol;
    // emit set fee protocol
  }

  function setTickSpacing(int24 _tickSpacing) external override onlyOwner {
    tickSpacing = _tickSpacing;
  }

  function setMaxLiquidityPerTick(uint128 _maxLiquidityPerTick) external override onlyOwner {
    maxLiquidityPerTick = _maxLiquidityPerTick;
  }

  function setFee(uint256 _fee) external override onlyOwner {
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

    IMarginEngine(marginEngineAddress).unwindPosition(msg.sender, tickLower, tickUpper);
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

    IMarginEngine(marginEngineAddress).updatePosition(params, vars);

    // clear any tick data that is no longer needed
    if (params.liquidityDelta < 0) {
      if (vars.flippedLower) {
        ticks.clear(params.tickLower);
      }
      if (vars.flippedUpper) {
        ticks.clear(params.tickUpper);
      }
    }

    rateOracle.writeOracleEntry();

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
  ) external override whenNotPaused checkCurrentTimestampTermEndTimestampDelta lock {
    
    /// might be helpful to have a higher level peripheral function for minting a given amount given a certain amount of notional an LP wants to support
    
    if (amount <= 0) {
      revert LiquidityDeltaMustBePositiveInMint(amount);
    }

    IMarginEngine(marginEngineAddress).checkPositionMarginRequirementSatisfied(
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
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta, uint256 _cumulativeFeeIncurred)
  {
    /// might be helpful to have a higher level peripheral function (initiateIRS) which then calls swap

    SwapLocalVars memory swapLocalVars;
    
    VAMMVars memory vammVarsStart = vammVars;

    checksBeforeSwap(params, vammVarsStart);

    if (params.isFT) {
      require(params.amountSpecified > 0, "AS>0");
    } else {
      require(params.amountSpecified < 0, "AS<0");
    }

    if (params.isUnwind) {
      require(msg.sender==marginEngineAddress, "only ME induce unwind");
    }

    /// @dev lock the vamm while the swap is taking place

    unlocked = false;

    /// suggestion: use uint32 for blockTimestamp (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L132)
    /// suggestion: feeProtocol can be represented in a more efficient way (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L69)
    // Uniswap implementation: feeProtocol: zeroForOne ? (slot0Start.feeProtocol % 16) : (slot0Start.feeProtocol >> 4), where in our case isFT == !zeroForOne
    SwapCache memory cache = SwapCache({
      liquidityStart: liquidity,
      blockTimestamp: Time.blockTimestampScaled(),
      feeProtocol: vammVars.feeProtocol
    });

    /// @dev amountSpecified = The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
    /// @dev Both FTs and VTs care about the notional of their IRS contract, the notional is the absolute amount of variableTokens traded
    /// @dev Hence, if an FT wishes to trade x notional, amountSpecified needs to be an exact input (in terms of the variableTokens they provide), hence amountSpecified needs to be positive
    /// @dev Also, if a VT wishes to trade x notional, amountSpecified needs to be an exact output (in terms of the variableTokens they receive), hence amountSpecified needs to be negative 
    /// @dev amountCalculated is the amount already swapped out/in of the output (variable taker) / input (fixed taker) asset
    /// @dev amountSpecified should always be in terms of the variable tokens

    SwapState memory state = SwapState({
      amountSpecifiedRemaining: params.amountSpecified,
      amountCalculated: 0,
      sqrtPriceX96: vammVarsStart.sqrtPriceX96,
      tick: vammVarsStart.tick,
      liquidity: cache.liquidityStart,
      fixedTokenGrowthGlobal: fixedTokenGrowthGlobal,
      variableTokenGrowthGlobal: variableTokenGrowthGlobal,
      feeGrowthGlobal: feeGrowthGlobal,
      protocolFee: 0,
      cumulativeFeeIncurred: 0
    });

    /// @dev write an entry to the rate oracle (given no throttling), should be a no-op

    rateOracle.writeOracleEntry();

    // continue swapping as long as we haven't used the entire input/output and haven't reached the price (implied fixed rate) limit
    while (
      state.amountSpecifiedRemaining != 0 &&
      state.sqrtPriceX96 != params.sqrtPriceLimitX96
    ) {
      StepComputations memory step;

      step.sqrtPriceStartX96 = state.sqrtPriceX96;


      /// @dev if isFT (fixed taker) (moving right to left), the nextInitializedTick should be more than or equal to the current tick
      /// @dev if !isFT (variable taker) (moving left to right), the nextInitializedTick should be less than or equal to the current tick
      /// add a test for the statement that checks for the above two conditions
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
        IMarginEngine(marginEngineAddress).termEndTimestamp() - Time.blockTimestampScaled()
      );

      if (params.amountSpecified > 0) {
        // is a Fixed Taker
        // exact input
        /// prb math is not used in here (following v3 logic)
        state.amountSpecifiedRemaining -= (step.amountIn).toInt256(); // this value is positive
        state.amountCalculated = state.amountCalculated.sub(
          (step.amountOut).toInt256()
        ); // this value is negative
      } else {
        // is a VariableTaker
        /// prb math is not used in here (following v3 logic)
        state.amountSpecifiedRemaining += step.amountOut.toInt256(); // this value is negative
        state.amountCalculated = state.amountCalculated.add(
          (step.amountIn).toInt256()
        ); // this value is positive
      }

      // update cumulative fee incurred while initiating an interest rate swap
      state.cumulativeFeeIncurred = state.cumulativeFeeIncurred + step.feeAmount;
      
      // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
      if (cache.feeProtocol > 0) {
        step.feeProtocolDelta = PRBMathUD60x18.mul(step.feeAmount, cache.feeProtocol); // as a percentage of LP fees
        step.feeAmount = step.feeAmount - step.feeProtocolDelta;
        state.protocolFee = state.protocolFee + step.feeProtocolDelta;
      }

      // update global fee tracker
      if (state.liquidity > 0) {
        uint256 variableFactor = rateOracle.variableFactor(
          IMarginEngine(marginEngineAddress).termStartTimestamp(),
          IMarginEngine(marginEngineAddress).termEndTimestamp()
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
          IMarginEngine(marginEngineAddress).termStartTimestamp(),
          IMarginEngine(marginEngineAddress).termEndTimestamp()
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

          // if we're moving rightward (along the virtual amm), we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (!params.isFT) liquidityNet = -liquidityNet;

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            liquidityNet
          );
        }

        state.tick = !params.isFT ? step.tickNext - 1 : step.tickNext;
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
      }
    }

    if (state.tick != vammVarsStart.tick) {
       // update the tick in case it changed
      vammVars.sqrtPriceX96 = state.sqrtPriceX96;
      vammVars.tick = state.tick;
    } else {
      // otherwise just update the price
      vammVars.sqrtPriceX96 = state.sqrtPriceX96;
    }

    // update liquidity if it changed
    if (cache.liquidityStart != state.liquidity) liquidity = state.liquidity;
    feeGrowthGlobal = state.feeGrowthGlobal;
    variableTokenGrowthGlobal = state.variableTokenGrowthGlobal;
    fixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal;
    _cumulativeFeeIncurred = state.cumulativeFeeIncurred;

    if (state.protocolFee > 0) {
      protocolFees = protocolFees + state.protocolFee;
    }

    if (params.isFT) {
      swapLocalVars.amount0 = uint256(-state.amountCalculated);
      swapLocalVars.amount1 = uint256(params.amountSpecified - state.amountSpecifiedRemaining);
    } else {
      swapLocalVars.amount0 = uint256(state.amountCalculated);
      swapLocalVars.amount1 = uint256(-(params.amountSpecified - state.amountSpecifiedRemaining));
    }

    if (params.isFT) {
      _variableTokenDelta = -int256(swapLocalVars.amount1);
      _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
        int256(swapLocalVars.amount0),
        -int256(swapLocalVars.amount1),
        rateOracle.variableFactor(
          IMarginEngine(marginEngineAddress).termStartTimestamp(),
          IMarginEngine(marginEngineAddress).termEndTimestamp()
        ),
        IMarginEngine(marginEngineAddress).termStartTimestamp(),
        IMarginEngine(marginEngineAddress).termEndTimestamp()
      );
    } else {
      _variableTokenDelta = int256(swapLocalVars.amount1);
      _fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
        -int256(swapLocalVars.amount0),
        int256(swapLocalVars.amount1),
        rateOracle.variableFactor(
          IMarginEngine(marginEngineAddress).termStartTimestamp(),
          IMarginEngine(marginEngineAddress).termEndTimestamp()
        ),
        IMarginEngine(marginEngineAddress).termStartTimestamp(),
        IMarginEngine(marginEngineAddress).termEndTimestamp()
      );
    }

    // if this is not the case then it is a position unwind induced swap triggered by a position liquidation which is handled in the position unwind function
    if (params.isTrader) {

      if (params.isUnwind) {
        IMarginEngine(marginEngineAddress).updateTraderMarginAfterUnwind(params.recipient, -int256(state.cumulativeFeeIncurred));
      } else {
        IMarginEngine(marginEngineAddress).updateTraderMargin(
          params.recipient,
          -int256(state.cumulativeFeeIncurred)
        );
      }

      IMarginEngine(marginEngineAddress).updateTraderBalances(
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
        SwapParams memory params,
        SwapState memory state,
        StepComputations memory step,
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

            /// @dev if the trader is a fixed taker then the variable token growth global should be incremented (since LPs are receiving variable tokens)
            /// @dev if the trader is a fixed taker then the fixed token growth global should decline (since LPs are providing fixed tokens)
            /// @dev if the trader is a fixed taker amountOut is in terms of variable tokens (it is a positive value)
            
            stateVariableTokenGrowthGlobal =
                state.variableTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    int256(step.amountOut),
                    int256(uint256(state.liquidity))
                );

            
            /// @dev fixedToken delta should be negative, hence amount0 passed into getFixedTokenBalance needs to be negative
            /// @dev in this case amountIn is in terms of unbalanced fixed tokens, hence the value passed needs to be negative --> -int256(step.amountIn),
            /// @dev in this case amountOut is in terms of variable tokens, hence the value passed needs to be positive --> int256(step.amountOut)

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

            /// @dev if a trader is a variable taker, the variable token growth should decline (since the LPs are providing variable tokens)
            /// @dev if a trader is a variable taker, the fixed token growth should increase (since the LPs are receiving fixed tokens)
            /// @dev if a trader is a variable taker amountIn is in terms of variable tokens
            
            stateVariableTokenGrowthGlobal =
                state.variableTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    -int256(step.amountIn),
                    int256(uint256(state.liquidity))
                );

            /// @dev fixed token delta should be positive (for LPs)
            /// @dev in this case amountIn is in terms of variable tokens, hence the value passed needs to be negative --> -int256(step.amountIn),
            /// @dev in this case amountOut is in terms of fixedToken, hence the value passed needs to be positive --> int256(step.amountOut),

            stateFixedTokenGrowthGlobal =
                state.fixedTokenGrowthGlobal +
                PRBMathSD59x18.div(
                    FixedAndVariableMath.getFixedTokenBalance(
                        int256(step.amountOut),
                        -int256(step.amountIn),
                        variableFactor,
                        termStartTimestamp,
                        termEndTimestamp
                    ),
                    int256(uint256(state.liquidity))
                );
        }
    }

}