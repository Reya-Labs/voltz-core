// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IVAMM.sol";
import "./core_libraries/TickBitmap.sol";
import "./utils/SafeCast.sol";
import "./utils/SqrtPriceMath.sol";
import "./core_libraries/SwapMath.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IFactory.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./utils/FixedPoint128.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


contract VAMM is IVAMM, Initializable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
  using SafeCast for uint256;
  using SafeCast for int256;
  using Tick for mapping(int24 => Tick.Info);
  using TickBitmap for mapping(int16 => uint256);

  /// @inheritdoc IVAMM
  uint256 public override feeWad;
  /// @inheritdoc IVAMM
  int24 public override tickSpacing;
  /// @inheritdoc IVAMM
  uint128 public override maxLiquidityPerTick;
  /// @inheritdoc IVAMM
  mapping(int24 => Tick.Info) public override ticks;
  /// @inheritdoc IVAMM
  mapping(int16 => uint256) public override tickBitmap;
  /// @inheritdoc IVAMM
  bool public override unlocked;

  IRateOracle internal rateOracle;

  /// @inheritdoc IVAMM
  IFactory public override factory;

  // cached termStartTimstampWad from the MarginEngine associated with the VAMM
  uint256 internal termStartTimestampWad;
  // cached termEndTimestampWad from the MarginEngine associated with the VAMM
  uint256 internal termEndTimestampWad;

  /// @dev Mutually exclusive reentrancy protection into the vamm to/from a method. This method also prevents entrance
  /// to a function before the vamm is initialized. The reentrancy guard is required throughout the contract.
  modifier lock() {
    require(unlocked, "LOK");
    unlocked = false;
    _;
    unlocked = true;
  }

  // https://ethereum.stackexchange.com/questions/68529/solidity-modifiers-in-library
  /// @dev Modifier that ensures new LP positions cannot be minted after one day before the maturity of the vamm
  /// @dev also ensures new swaps cannot be conducted after one day before maturity of the vamm
  modifier checkCurrentTimestampTermEndTimestampDelta() {
    if (Time.isCloseToMaturityOrBeyondMaturity(termEndTimestampWad)) {
      revert("closeToOrBeyondMaturity");
    }
    _;
  }

  // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor () initializer {}

  /// @inheritdoc IVAMM
  function initialize(address _marginEngineAddress, int24 _tickSpacing) external override initializer {
    require(_marginEngineAddress != address(0), "ME must be set");
    marginEngine = IMarginEngine(_marginEngineAddress);
    rateOracle = marginEngine.rateOracle();
    factory = IFactory(msg.sender);
    tickSpacing = _tickSpacing;
    maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(_tickSpacing);
    termStartTimestampWad = marginEngine.termStartTimestampWad();
    termEndTimestampWad = marginEngine.termEndTimestampWad();

    __Ownable_init();
    __Pausable_init();
    __UUPSUpgradeable_init();
  }

  // To authorize the owner to upgrade the contract we implement _authorizeUpgrade with the onlyOwner modifier.   
  // ref: https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786 
  function _authorizeUpgrade(address) internal override onlyOwner {}

  /// @inheritdoc IVAMM
  VAMMVars public override vammVars;

  /// @inheritdoc IVAMM
  int256 public override fixedTokenGrowthGlobalX128;

  /// @inheritdoc IVAMM
  int256 public override variableTokenGrowthGlobalX128;

  /// @inheritdoc IVAMM
  uint256 public override feeGrowthGlobalX128;

  /// @inheritdoc IVAMM
  uint128 public override liquidity;

  /// @inheritdoc IVAMM
  uint256 public override protocolFees;

  /// @inheritdoc IVAMM
  IMarginEngine public override marginEngine;

  /// @dev modifier that ensures the
  modifier onlyMarginEngine () {
    if (msg.sender != address(marginEngine)) {
        revert OnlyMarginEngine();
    }
    _;
  }

  function updateProtocolFees(uint256 protocolFeesCollected)
    external
    override
    onlyMarginEngine
  {
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

    emit InitializeVAMM(sqrtPriceX96, tick);
  }

  function setFeeProtocol(uint8 feeProtocol) external override onlyOwner lock {
    uint8 feeProtocolOld = vammVars.feeProtocol;
    vammVars.feeProtocol = feeProtocol;
    emit SetFeeProtocol(feeProtocolOld, feeProtocol);
  }

  function setFee(uint256 _feeWad) external override onlyOwner lock {
    uint256 feeWadOld = feeWad;
    feeWad = _feeWad;
    emit FeeSet(feeWadOld, feeWad);
  }

  function burn(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override whenNotPaused lock returns(int256 positionMarginRequirement) {

    /// @dev if msg.sender is the MarginEngine, it is a burn induced by a position liquidation

    if (amount <= 0) {
      revert LiquidityDeltaMustBePositiveInBurn(amount);
    }

    require((msg.sender==recipient) || (msg.sender == address(marginEngine)) || factory.isApproved(recipient, msg.sender) , "MS or ME");

    positionMarginRequirement = updatePosition(
      ModifyPositionParams({
        owner: recipient,
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidityDelta: -int256(uint256(amount)).toInt128()
      })
    );

    emit Burn(msg.sender, recipient, tickLower, tickUpper, amount);
  }

  function flipTicks(ModifyPositionParams memory params)
    internal
    returns (bool flippedLower, bool flippedUpper)
  {
    flippedLower = ticks.update(
      params.tickLower,
      vammVars.tick,
      params.liquidityDelta,
      fixedTokenGrowthGlobalX128,
      variableTokenGrowthGlobalX128,
      feeGrowthGlobalX128,
      false,
      maxLiquidityPerTick
    );

    flippedUpper = ticks.update(
      params.tickUpper,
      vammVars.tick,
      params.liquidityDelta,
      fixedTokenGrowthGlobalX128,
      variableTokenGrowthGlobalX128,
      feeGrowthGlobalX128,
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


  function updatePosition(ModifyPositionParams memory params) private returns(int256 positionMarginRequirement) {

    /// @dev give a more descriptive name

    Tick.checkTicks(params.tickLower, params.tickUpper);

    VAMMVars memory _vammVars = vammVars; // SLOAD for gas optimization

    bool flippedLower;
    bool flippedUpper;

    /// @dev update the ticks if necessary
    if (params.liquidityDelta != 0) {
      (flippedLower, flippedUpper) = flipTicks(params);
    }

    positionMarginRequirement = 0;
    if (msg.sender != address(marginEngine)) { 
      // this only happens if the margin engine triggers a liquidation which in turn triggers a burn
      // the state updated in the margin engine in that case are done directly in the liquidatePosition function
      positionMarginRequirement = marginEngine.updatePositionPostVAMMInducedMintBurn(params);
    }

    // clear any tick data that is no longer needed
    if (params.liquidityDelta < 0) {
      if (flippedLower) {
        ticks.clear(params.tickLower);
      }
      if (flippedUpper) {
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
  ) external override whenNotPaused checkCurrentTimestampTermEndTimestampDelta lock returns(int256 positionMarginRequirement) {

    /// might be helpful to have a higher level peripheral function for minting a given amount given a certain amount of notional an LP wants to support

    if (amount <= 0) {
      revert LiquidityDeltaMustBePositiveInMint(amount);
    }

    require(msg.sender==recipient || factory.isApproved(recipient, msg.sender), "only msg.sender or approved can mint");

    positionMarginRequirement = updatePosition(
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
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta, uint256 _cumulativeFeeIncurred, int256 _fixedTokenDeltaUnbalanced, int256 _marginRequirement)
  {

    VAMMVars memory vammVarsStart = vammVars;

    checksBeforeSwap(params, vammVarsStart, params.amountSpecified > 0);
    
    if (!(msg.sender == address(marginEngine) || msg.sender==address(marginEngine.fcm()))) {
      require(msg.sender==params.recipient || factory.isApproved(params.recipient, msg.sender), "only sender or approved integration");
    }

    Tick.checkTicks(params.tickLower, params.tickUpper);

    /// @dev lock the vamm while the swap is taking place

    unlocked = false;

    /// suggestion: use uint32 for blockTimestamp (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L132)
    /// suggestion: feeProtocol can be represented in a more efficient way (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L69)
    // Uniswap implementation: feeProtocol: zeroForOne ? (slot0Start.feeProtocol % 16) : (slot0Start.feeProtocol >> 4), where in our case isFT == !zeroForOne
    SwapCache memory cache = SwapCache({
      liquidityStart: liquidity,
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
      fixedTokenGrowthGlobalX128: fixedTokenGrowthGlobalX128,
      variableTokenGrowthGlobalX128: variableTokenGrowthGlobalX128,
      feeGrowthGlobalX128: feeGrowthGlobalX128,
      protocolFee: 0,
      cumulativeFeeIncurred: 0,
      fixedTokenDeltaCumulative: 0, // for Trader (user invoking the swap)
      variableTokenDeltaCumulative: 0, // for Trader (user invoking the swap),
      fixedTokenDeltaUnbalancedCumulative: 0 //  for Trader (user invoking the swap)
    });

    /// @dev write an entry to the rate oracle (given no throttling)

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
        .nextInitializedTickWithinOneWord(state.tick, tickSpacing, !(params.amountSpecified > 0));

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
          !(params.amountSpecified > 0)
            ? step.sqrtPriceNextX96 < params.sqrtPriceLimitX96
            : step.sqrtPriceNextX96 > params.sqrtPriceLimitX96
        )
          ? params.sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        feeWad,
        termEndTimestampWad - Time.blockTimestampScaled()
      );

      if (params.amountSpecified > 0) {
        // User is a Fixed Taker
        // exact input
        /// prb math is not used in here (following v3 logic)
        state.amountSpecifiedRemaining -= (step.amountIn).toInt256(); // this value is positive
        state.amountCalculated -= step.amountOut.toInt256(); // this value is negative

        // LP is a Variable Taker
        step.variableTokenDelta = (step.amountIn).toInt256();
        step.fixedTokenDeltaUnbalanced = -step.amountOut.toInt256();
      } else {
        // User is a VariableTaker
        /// prb math is not used in here (following v3 logic)
        state.amountSpecifiedRemaining += step.amountOut.toInt256(); // this value is negative
        state.amountCalculated += step.amountIn.toInt256(); // this value is positive

        // LP is a Fixed Taker
        step.variableTokenDelta = -step.amountOut.toInt256();
        step.fixedTokenDeltaUnbalanced = step.amountIn.toInt256();
      }

      // update cumulative fee incurred while initiating an interest rate swap
      state.cumulativeFeeIncurred = state.cumulativeFeeIncurred + step.feeAmount;

      // if the protocol fee is on, calculate how much is owed, decrement feeAmount, and increment protocolFee
      if (cache.feeProtocol > 0) {
        /// here we should round towards protocol fees (+ ((step.feeAmount % cache.feeProtocol == 0) ? 0 : 1)) ?
        step.feeProtocolDelta = step.feeAmount / cache.feeProtocol;
        step.feeAmount -= step.feeProtocolDelta;
        state.protocolFee += step.feeProtocolDelta;
      }

      // update global fee tracker
      if (state.liquidity > 0) {
        (
          state.feeGrowthGlobalX128,
          state.variableTokenGrowthGlobalX128,
          state.fixedTokenGrowthGlobalX128,
          step.fixedTokenDelta // for LP
        ) = calculateUpdatedGlobalTrackerValues(
          params.amountSpecified > 0,
          state,
          step,
          rateOracle.variableFactor(
          termStartTimestampWad,
          termEndTimestampWad
          )
        );

        state.fixedTokenDeltaCumulative -= step.fixedTokenDelta; // opposite sign from that of the LP's
        state.variableTokenDeltaCumulative -= step.variableTokenDelta; // opposite sign from that of the LP's
        
        // necessary for testing purposes, also handy to quickly compute the fixed rate at which an interest rate swap is created
        state.fixedTokenDeltaUnbalancedCumulative -= step.fixedTokenDeltaUnbalanced;
      }

      // shift tick if we reached the next price
      if (state.sqrtPriceX96 == step.sqrtPriceNextX96) {
        // if the tick is initialized, run the tick transition
        if (step.initialized) {
          int128 liquidityNet = ticks.cross(
            step.tickNext,
            state.fixedTokenGrowthGlobalX128,
            state.variableTokenGrowthGlobalX128,
            state.feeGrowthGlobalX128
          );

          // if we're moving rightward (along the virtual amm), we interpret liquidityNet as the opposite sign
          // safe because liquidityNet cannot be type(int128).min
          if (!(params.amountSpecified > 0)) liquidityNet = -liquidityNet;

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            liquidityNet
          );

        }

        state.tick = !(params.amountSpecified > 0) ? step.tickNext - 1 : step.tickNext;
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

    feeGrowthGlobalX128 = state.feeGrowthGlobalX128;
    variableTokenGrowthGlobalX128 = state.variableTokenGrowthGlobalX128;
    fixedTokenGrowthGlobalX128 = state.fixedTokenGrowthGlobalX128;

    _cumulativeFeeIncurred = state.cumulativeFeeIncurred;
    _fixedTokenDelta = state.fixedTokenDeltaCumulative;
    _variableTokenDelta = state.variableTokenDeltaCumulative;
    _fixedTokenDeltaUnbalanced = state.fixedTokenDeltaUnbalancedCumulative;

    if (state.protocolFee > 0) {
      protocolFees += state.protocolFee;
    }

    /// @dev if it is an unwind then state change happen direcly in the MarginEngine to avoid making an unnecessary external call
    if (!(msg.sender == address(marginEngine) || msg.sender==address(marginEngine.fcm()))) {
      _marginRequirement = marginEngine.updatePositionPostVAMMInducedSwap(params.recipient, params.tickLower, params.tickUpper, state.fixedTokenDeltaCumulative, state.variableTokenDeltaCumulative, state.cumulativeFeeIncurred, state.fixedTokenDeltaUnbalancedCumulative);
    }

    emit Swap(
      msg.sender,
      params.recipient,
      state.sqrtPriceX96,
      state.liquidity,
      state.tick,
      params.tickLower,
      params.tickUpper
    );

    unlocked = true;
  }

  /// @inheritdoc IVAMM
  function computeGrowthInside(
    int24 tickLower,
    int24 tickUpper
  )
    external
    view
    override
    returns (int256 fixedTokenGrowthInsideX128, int256 variableTokenGrowthInsideX128, uint256 feeGrowthInsideX128)
  {

    fixedTokenGrowthInsideX128 = ticks.getFixedTokenGrowthInside(
      Tick.FixedTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: vammVars.tick,
        fixedTokenGrowthGlobalX128: fixedTokenGrowthGlobalX128
      })
    );

    variableTokenGrowthInsideX128 = ticks.getVariableTokenGrowthInside(
      Tick.VariableTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: vammVars.tick,
        variableTokenGrowthGlobalX128: variableTokenGrowthGlobalX128
      })
    );

    feeGrowthInsideX128 = ticks.getFeeGrowthInside(
      tickLower,
      tickUpper,
      vammVars.tick,
      feeGrowthGlobalX128
    );

  }

  function checksBeforeSwap(
      SwapParams memory params,
      VAMMVars memory vammVarsStart,
      bool isFT
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
          isFT
              ? params.sqrtPriceLimitX96 > vammVarsStart.sqrtPriceX96 &&
                  params.sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
              : params.sqrtPriceLimitX96 < vammVarsStart.sqrtPriceX96 &&
                  params.sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,
          "SPL"
      );
  }


    function calculateUpdatedGlobalTrackerValues(
        bool isFT,
        SwapState memory state,
        StepComputations memory step,
        uint256 variableFactorWad
    )
        internal
        view
        returns (
            uint256 stateFeeGrowthGlobalX128,
            int256 stateVariableTokenGrowthGlobalX128,
            int256 stateFixedTokenGrowthGlobalX128,
            int256 fixedTokenDelta// for LP
        )
    {

        stateFeeGrowthGlobalX128 = state.feeGrowthGlobalX128 + FullMath.mulDiv(step.feeAmount, FixedPoint128.Q128, state.liquidity);

        if (isFT) {

            /// @dev if the trader is a fixed taker then the variable token growth global should be incremented (since LPs are receiving variable tokens)
            /// @dev if the trader is a fixed taker then the fixed token growth global should decline (since LPs are providing fixed tokens)
            /// @dev if the trader is a fixed taker amountOut is in terms of variable tokens (it is a positive value)

            /// @audit-casting step.variableTokenDelta is expected to be positive here, but what if goes below 0 due to rounding imprecision? 
            stateVariableTokenGrowthGlobalX128 = state.variableTokenGrowthGlobalX128 + int256(FullMath.mulDiv(uint256(step.variableTokenDelta), FixedPoint128.Q128, state.liquidity));

            /// @dev fixedToken delta should be negative, hence amount0 passed into getFixedTokenBalance needs to be negative
            /// @dev in this case amountIn is in terms of unbalanced fixed tokens, hence the value passed needs to be negative --> -int256(step.amountIn),
            /// @dev in this case amountOut is in terms of variable tokens, hence the value passed needs to be positive --> int256(step.amountOut)

            // this value is negative
            fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
              step.fixedTokenDeltaUnbalanced,
              step.variableTokenDelta,
              variableFactorWad,
              termStartTimestampWad,
              termEndTimestampWad
            );

            /// @audit-casting fixedTokenDelta is expected to be negative here, but what if goes above 0 due to rounding imprecision? 
            stateFixedTokenGrowthGlobalX128 = state.fixedTokenGrowthGlobalX128 - int256(FullMath.mulDiv(uint256(-fixedTokenDelta), FixedPoint128.Q128, state.liquidity));

        } else {

            /// @dev if a trader is a variable taker, the variable token growth should decline (since the LPs are providing variable tokens)
            /// @dev if a trader is a variable taker, the fixed token growth should increase (since the LPs are receiving fixed tokens)
            /// @dev if a trader is a variable taker amountIn is in terms of variable tokens

            /// @audit-casting step.variableTokenDelta is expected to be negative here, but what if goes above 0 due to rounding imprecision? 
            stateVariableTokenGrowthGlobalX128= state.variableTokenGrowthGlobalX128 - int256(FullMath.mulDiv(uint256(-step.variableTokenDelta), FixedPoint128.Q128, state.liquidity));

            /// @dev fixed token delta should be positive (for LPs)
            /// @dev in this case amountIn is in terms of variable tokens, hence the value passed needs to be negative --> -int256(step.amountIn),
            /// @dev in this case amountOut is in terms of fixedToken, hence the value passed needs to be positive --> int256(step.amountOut),

            // this value is positive
            fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
              step.fixedTokenDeltaUnbalanced,
              step.variableTokenDelta,
              variableFactorWad,
              termStartTimestampWad,
              termEndTimestampWad
            );

            /// @audit-casting fixedTokenDelta is expected to be positive here, but what if goes below 0 due to rounding imprecision? 
            stateFixedTokenGrowthGlobalX128 = state.fixedTokenGrowthGlobalX128 + int256(FullMath.mulDiv(uint256(fixedTokenDelta), FixedPoint128.Q128, state.liquidity));
        }
    }

}