// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./storage/VAMMStorage.sol";
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


contract VAMM is VAMMStorage, IVAMM, Initializable, OwnableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
  using SafeCast for uint256;
  using SafeCast for int256;
  using Tick for mapping(int24 => Tick.Info);
  using TickBitmap for mapping(int16 => uint256);

  /// @dev 0.02 = 2% is the max fee as proportion of notional scaled by time to maturity (in wei fixed point notation 0.02 -> 2 * 10^16)
  uint256 public constant MAX_FEE = 20000000000000000; 

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
  function initialize(IMarginEngine __marginEngine, int24 __tickSpacing) external override initializer {

    require(address(__marginEngine) != address(0), "ME must be set");
    // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
    // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick
    // 16384 ticks represents a >5x price change with ticks of 1 bips
    require(__tickSpacing > 0 && __tickSpacing < Tick.MAXIMUM_TICK_SPACING, "TSOOB");

    _marginEngine = __marginEngine;
    rateOracle = _marginEngine.rateOracle();
    _factory = IFactory(msg.sender);
    _tickSpacing = __tickSpacing;
    _maxLiquidityPerTick = Tick.tickSpacingToMaxLiquidityPerTick(_tickSpacing);
    termStartTimestampWad = _marginEngine.termStartTimestampWad();
    termEndTimestampWad = _marginEngine.termEndTimestampWad();

    __Ownable_init();
    __Pausable_init();
    __UUPSUpgradeable_init();
  }

  // To authorize the owner to upgrade the contract we implement _authorizeUpgrade with the onlyOwner modifier.   
  // ref: https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786 
  function _authorizeUpgrade(address) internal override onlyOwner {}


  // GETTERS FOR STORAGE SLOTS
  // Not auto-generated by public variables in the storage contract, cos solidity doesn't support that for functions that implement an interface
  /// @inheritdoc IVAMM
  function feeWad() external view override returns (uint256) {
      return _feeWad;
  }
  /// @inheritdoc IVAMM
  function tickSpacing() external view override returns (int24) {
      return _tickSpacing;
  }
  /// @inheritdoc IVAMM
  function maxLiquidityPerTick() external view override returns (uint128) {
      return _maxLiquidityPerTick;
  }
  /// @inheritdoc IVAMM
  function feeGrowthGlobalX128() external view override returns (uint256) {
      return _feeGrowthGlobalX128;
  }
  /// @inheritdoc IVAMM
  function protocolFees() external view override returns (uint256) {
      return _protocolFees;
  }
  /// @inheritdoc IVAMM
  function fixedTokenGrowthGlobalX128() external view override returns (int256) {
      return _fixedTokenGrowthGlobalX128;
  }
  /// @inheritdoc IVAMM
  function variableTokenGrowthGlobalX128() external view override returns (int256) {
      return _variableTokenGrowthGlobalX128;
  }
  /// @inheritdoc IVAMM
  function liquidity() external view override returns (uint128) {
      return _liquidity;
  }
  /// @inheritdoc IVAMM
  function factory() external view override returns (IFactory) {
      return _factory;
  }
  /// @inheritdoc IVAMM
  function marginEngine() external view override returns (IMarginEngine) {
      return _marginEngine;
  }
  /// @inheritdoc IVAMM
  function ticks(int24 tick)
    external
    view
    override
    returns (Tick.Info memory) {
    return _ticks[tick];
  }
  /// @inheritdoc IVAMM
  function tickBitmap(int16 wordPosition) external view override returns (uint256) {
    return _tickBitmap[wordPosition];
  }
  /// @inheritdoc IVAMM
  function vammVars() external view override returns (VAMMVars memory) {
      return _vammVars;
  }

  /// @dev modifier that ensures the
  modifier onlyMarginEngine () {
    if (msg.sender != address(_marginEngine)) {
        revert CustomErrors.OnlyMarginEngine();
    }
    _;
  }

  function updateProtocolFees(uint256 protocolFeesCollected)
    external
    override
    onlyMarginEngine
  {
    if (_protocolFees < protocolFeesCollected) {
      revert CustomErrors.NotEnoughFunds(protocolFeesCollected, _protocolFees);
    }
    _protocolFees -= protocolFeesCollected;
  }

  /// @dev not locked because it initializes unlocked
  function initializeVAMM(uint160 sqrtPriceX96) external override {
    
    require(sqrtPriceX96 != 0, "zero input price");

    /// @dev initializeVAMM should only be callable given the initialize function was already executed
    /// @dev we can check if the initialize function was executed by making sure the address of the margin engine is non-zero since it is set in the initialize function
    require(address(_marginEngine) != address(0), "vamm not initialized");
    /// @audit tag 1 [ABDK]
    // This function could be called by anyone and there is no economical incentives to provide a fair price here.
    // Consider requiring the caller to provide certain amount of liquidity along with the call, which would motivate the caller to set the price close to the fair price.
    
    if (_vammVars.sqrtPriceX96 != 0)  {
      revert CustomErrors.ExpectedSqrtPriceZeroBeforeInit(_vammVars.sqrtPriceX96);
    }

    int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

    _vammVars = VAMMVars({ sqrtPriceX96: sqrtPriceX96, tick: tick, feeProtocol: 0 });

    /// @audit tag 2 [ABDK]
    // It is not guaranteed that the “initialize” function was already executed, so it is possible to unlock a not fully initialized instance.  
    // Consider adding an appropriate check.

    unlocked = true;

    emit InitializeVAMM(sqrtPriceX96, tick);
  }

  function setFeeProtocol(uint8 feeProtocol) external override onlyOwner lock {

    // todo: agree on the range, assign constant to upper and lower range limits
    require(feeProtocol == 0 || (feeProtocol >= 3 && feeProtocol <= 50), "PR range");
    require(_vammVars.feeProtocol != feeProtocol, "PF value already set");

    uint8 feeProtocolOld = _vammVars.feeProtocol;
    _vammVars.feeProtocol = feeProtocol;
    emit SetFeeProtocol(feeProtocolOld, feeProtocol);
  }

  function setFee(uint256 newFeeWad) external override onlyOwner lock {

    // todo: agree on the range, assign constant to upper limit (MAX_FEE)
    require(newFeeWad >= 0 && newFeeWad <= MAX_FEE, "fee range");
    require(_feeWad != newFeeWad, "fee value already set");

    uint256 feeWadOld = _feeWad;
    _feeWad = newFeeWad;
    emit FeeSet(feeWadOld, _feeWad);
  }

  function burn(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override whenNotPaused lock returns(int256 positionMarginRequirement) {

    /// @dev if msg.sender is the MarginEngine, it is a burn induced by a position liquidation

    if (amount <= 0) {
      revert CustomErrors.LiquidityDeltaMustBePositiveInBurn(amount);
    }

    require((msg.sender==recipient) || (msg.sender == address(_marginEngine)) || _factory.isApproved(recipient, msg.sender) , "MS or ME");

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

    Tick.checkTicks(params.tickLower, params.tickUpper);


    /// @dev isUpper = false
    flippedLower = _ticks.update(
      params.tickLower,
      _vammVars.tick,
      params.liquidityDelta,
      _fixedTokenGrowthGlobalX128,
      _variableTokenGrowthGlobalX128,
      _feeGrowthGlobalX128,
      false,
      _maxLiquidityPerTick
    );

    /// @dev isUpper = true
    flippedUpper = _ticks.update(
      params.tickUpper,
      _vammVars.tick,
      params.liquidityDelta,
      _fixedTokenGrowthGlobalX128,
      _variableTokenGrowthGlobalX128,
      _feeGrowthGlobalX128,
      true,
      _maxLiquidityPerTick
    );

    if (flippedLower) {
      _tickBitmap.flipTick(params.tickLower, _tickSpacing);
    }

    if (flippedUpper) {
      _tickBitmap.flipTick(params.tickUpper, _tickSpacing);
    }
  }


  function updatePosition(ModifyPositionParams memory params) private returns(int256 positionMarginRequirement) {

    /// @dev give a more descriptive name

    Tick.checkTicks(params.tickLower, params.tickUpper);

    VAMMVars memory lvammVars = _vammVars; // SLOAD for gas optimization

    bool flippedLower;
    bool flippedUpper;

    /// @dev update the ticks if necessary
    if (params.liquidityDelta != 0) {
      (flippedLower, flippedUpper) = flipTicks(params);
    }

    positionMarginRequirement = 0;
    if (msg.sender != address(_marginEngine)) { 
      // this only happens if the margin engine triggers a liquidation which in turn triggers a burn
      // the state updated in the margin engine in that case are done directly in the liquidatePosition function
      positionMarginRequirement = _marginEngine.updatePositionPostVAMMInducedMintBurn(params);
    }
    
    // clear any tick data that is no longer needed
    if (params.liquidityDelta < 0) {
      if (flippedLower) {
        _ticks.clear(params.tickLower);
      }
      if (flippedUpper) {
        _ticks.clear(params.tickUpper);
      }
    }

    rateOracle.writeOracleEntry();

    if (params.liquidityDelta != 0) {
      if (
        (lvammVars.tick >= params.tickLower) && (lvammVars.tick < params.tickUpper)
      ) {
        // current tick is inside the passed range
        uint128 liquidityBefore = _liquidity; // SLOAD for gas optimization

        _liquidity = LiquidityMath.addDelta(
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
      revert CustomErrors.LiquidityDeltaMustBePositiveInMint(amount);
    }

    require(msg.sender==recipient || _factory.isApproved(recipient, msg.sender), "only msg.sender or approved can mint");

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

    Tick.checkTicks(params.tickLower, params.tickUpper);
    
    VAMMVars memory vammVarsStart = _vammVars;

    checksBeforeSwap(params, vammVarsStart, params.amountSpecified > 0);
    
    if (!(msg.sender == address(_marginEngine) || msg.sender==address(_marginEngine.fcm()))) {
      require(msg.sender==params.recipient || _factory.isApproved(params.recipient, msg.sender), "only sender or approved integration");
    }

    /// @dev lock the vamm while the swap is taking place
    unlocked = false;

    /// suggestion: use uint32 for blockTimestamp (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L132)
    /// suggestion: feeProtocol can be represented in a more efficient way (https://github.com/Uniswap/v3-core/blob/9161f9ae4aaa109f7efdff84f1df8d4bc8bfd042/contracts/UniswapV3Pool.sol#L69)
    // Uniswap implementation: feeProtocol: zeroForOne ? (slot0Start.feeProtocol % 16) : (slot0Start.feeProtocol >> 4), where in our case isFT == !zeroForOne
    SwapCache memory cache = SwapCache({
      liquidityStart: _liquidity,
      feeProtocol: _vammVars.feeProtocol
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
      fixedTokenGrowthGlobalX128: _fixedTokenGrowthGlobalX128,
      variableTokenGrowthGlobalX128: _variableTokenGrowthGlobalX128,
      feeGrowthGlobalX128: _feeGrowthGlobalX128,
      protocolFee: 0,
      cumulativeFeeIncurred: 0,
      fixedTokenDeltaCumulative: 0, // for Trader (user invoking the swap)
      variableTokenDeltaCumulative: 0, // for Trader (user invoking the swap),
      fixedTokenDeltaUnbalancedCumulative: 0 //  for Trader (user invoking the swap)
    });

    /// @dev write an entry to the rate oracle (given no throttling)

    rateOracle.writeOracleEntry();

    /// @audit tag 3 [ABDK]
    // On every iteration of this loop there are several places where different code is executed depending on the trade side.  
    // It would be more efficient to have two separate loop implementations and choose what implementation to run based on the trade side.

    // continue swapping as long as we haven't used the entire input/output and haven't reached the price (implied fixed rate) limit
    if (params.amountSpecified > 0) { 
      // Fixed Taker
      while (
      state.amountSpecifiedRemaining != 0 &&
      state.sqrtPriceX96 != params.sqrtPriceLimitX96
    ) {
      StepComputations memory step;

      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      /// the nextInitializedTick should be more than or equal to the current tick
      /// add a test for the statement that checks for the above two conditions
      (step.tickNext, step.initialized) = _tickBitmap
        .nextInitializedTickWithinOneWord(state.tick, _tickSpacing, false);

      // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
      if (step.tickNext > TickMath.MAX_TICK) {
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
        step.sqrtPriceNextX96 > params.sqrtPriceLimitX96
          ? params.sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        _feeWad,
        termEndTimestampWad - Time.blockTimestampScaled()
      );

      // exact input
      /// prb math is not used in here (following v3 logic)
      state.amountSpecifiedRemaining -= (step.amountIn).toInt256(); // this value is positive
      state.amountCalculated -= step.amountOut.toInt256(); // this value is negative

      // LP is a Variable Taker
      step.variableTokenDelta = (step.amountIn).toInt256();
      step.fixedTokenDeltaUnbalanced = -step.amountOut.toInt256();

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
          true,
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
          int128 liquidityNet = _ticks.cross(
            step.tickNext,
            state.fixedTokenGrowthGlobalX128,
            state.variableTokenGrowthGlobalX128,
            state.feeGrowthGlobalX128
          );

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            liquidityNet
          );

        }

        state.tick = step.tickNext;
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
      }
    }
    }
    else {
      while (
      state.amountSpecifiedRemaining != 0 &&
      state.sqrtPriceX96 != params.sqrtPriceLimitX96
    ) {
      StepComputations memory step;

      step.sqrtPriceStartX96 = state.sqrtPriceX96;

      /// @dev if isFT (fixed taker) (moving right to left), the nextInitializedTick should be more than or equal to the current tick
      /// @dev if !isFT (variable taker) (moving left to right), the nextInitializedTick should be less than or equal to the current tick
      /// add a test for the statement that checks for the above two conditions
      (step.tickNext, step.initialized) = _tickBitmap
        .nextInitializedTickWithinOneWord(state.tick, _tickSpacing, true);

      // ensure that we do not overshoot the min/max tick, as the tick bitmap is not aware of these bounds
      if (step.tickNext < TickMath.MIN_TICK) {
        step.tickNext = TickMath.MIN_TICK;
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
        step.sqrtPriceNextX96 < params.sqrtPriceLimitX96
          ? params.sqrtPriceLimitX96
          : step.sqrtPriceNextX96,
        state.liquidity,
        state.amountSpecifiedRemaining,
        _feeWad,
        termEndTimestampWad - Time.blockTimestampScaled()
      );

      /// prb math is not used in here (following v3 logic)
      state.amountSpecifiedRemaining += step.amountOut.toInt256(); // this value is negative
      state.amountCalculated += step.amountIn.toInt256(); // this value is positive

      // LP is a Fixed Taker
      step.variableTokenDelta = -step.amountOut.toInt256();
      step.fixedTokenDeltaUnbalanced = step.amountIn.toInt256();

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
          false,
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
          int128 liquidityNet = _ticks.cross(
            step.tickNext,
            state.fixedTokenGrowthGlobalX128,
            state.variableTokenGrowthGlobalX128,
            state.feeGrowthGlobalX128
          );

          state.liquidity = LiquidityMath.addDelta(
            state.liquidity,
            -liquidityNet
          );

        }

        state.tick = step.tickNext - 1;
      } else if (state.sqrtPriceX96 != step.sqrtPriceStartX96) {
        // recompute unless we're on a lower tick boundary (i.e. already transitioned ticks), and haven't moved
        state.tick = TickMath.getTickAtSqrtRatio(state.sqrtPriceX96);
      }
    }
    }
    _vammVars.sqrtPriceX96 = state.sqrtPriceX96;

    if (state.tick != vammVarsStart.tick) {
       // update the tick in case it changed
      _vammVars.tick = state.tick;
    }

    // update liquidity if it changed
    if (cache.liquidityStart != state.liquidity) _liquidity = state.liquidity;

    _feeGrowthGlobalX128 = state.feeGrowthGlobalX128;
    _variableTokenGrowthGlobalX128 = state.variableTokenGrowthGlobalX128;
    _fixedTokenGrowthGlobalX128 = state.fixedTokenGrowthGlobalX128;

    _cumulativeFeeIncurred = state.cumulativeFeeIncurred;
    _fixedTokenDelta = state.fixedTokenDeltaCumulative;
    _variableTokenDelta = state.variableTokenDeltaCumulative;
    _fixedTokenDeltaUnbalanced = state.fixedTokenDeltaUnbalancedCumulative;

    if (state.protocolFee > 0) {
      _protocolFees += state.protocolFee;
    }

    /// @dev if it is an unwind then state change happen direcly in the MarginEngine to avoid making an unnecessary external call
    if (!(msg.sender == address(_marginEngine) || msg.sender==address(_marginEngine.fcm()))) {
      _marginRequirement = _marginEngine.updatePositionPostVAMMInducedSwap(params.recipient, params.tickLower, params.tickUpper, state.fixedTokenDeltaCumulative, state.variableTokenDeltaCumulative, state.cumulativeFeeIncurred, state.fixedTokenDeltaUnbalancedCumulative);
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

    Tick.checkTicks(tickLower, tickUpper);

    fixedTokenGrowthInsideX128 = _ticks.getFixedTokenGrowthInside(
      Tick.FixedTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: _vammVars.tick,
        fixedTokenGrowthGlobalX128: _fixedTokenGrowthGlobalX128
      })
    );

    variableTokenGrowthInsideX128 = _ticks.getVariableTokenGrowthInside(
      Tick.VariableTokenGrowthInsideParams({
        tickLower: tickLower,
        tickUpper: tickUpper,
        tickCurrent: _vammVars.tick,
        variableTokenGrowthGlobalX128: _variableTokenGrowthGlobalX128
      })
    );

    feeGrowthInsideX128 = _ticks.getFeeGrowthInside(
      tickLower,
      tickUpper,
      _vammVars.tick,
      _feeGrowthGlobalX128
    );

  }

  function checksBeforeSwap(
      SwapParams memory params,
      VAMMVars memory vammVarsStart,
      bool isFT
  ) internal view {

      if (params.amountSpecified == 0) {
          revert CustomErrors.IRSNotionalAmountSpecifiedMustBeNonZero(
              params.amountSpecified
          );
      }

      if (!unlocked) {
          revert CustomErrors.CanOnlyTradeIfUnlocked(unlocked);
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

        fixedTokenDelta = FixedAndVariableMath.getFixedTokenBalance(
          step.fixedTokenDeltaUnbalanced,
          step.variableTokenDelta,
          variableFactorWad,
          termStartTimestampWad,
          termEndTimestampWad
        );

        stateVariableTokenGrowthGlobalX128 = state.variableTokenGrowthGlobalX128 + FullMath.mulDivSigned(step.variableTokenDelta, FixedPoint128.Q128, state.liquidity);
  
        stateFixedTokenGrowthGlobalX128 = state.fixedTokenGrowthGlobalX128 + FullMath.mulDivSigned(fixedTokenDelta, FixedPoint128.Q128, state.liquidity);
    }

}