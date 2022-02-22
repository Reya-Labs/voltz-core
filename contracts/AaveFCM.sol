// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFCM.sol";
import "./core_libraries/TraderWithYieldBearingAssets.sol";
import "./interfaces/IERC20Minimal.sol";
import "./interfaces/IVAMM.sol";
import "./interfaces/aave/IAaveV2LendingPool.sol";
import "./interfaces/rate_oracles/IAaveRateOracle.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./utils/WayRayMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./aave/AaveDataTypes.sol";
import "./core_libraries/SafeTransferLib.sol";

// optional: margin topup function (in terms of yield bearing tokens)

contract AaveFCM is IFCM, Initializable, OwnableUpgradeable, PausableUpgradeable {

  using WadRayMath for uint256;

  using TraderWithYieldBearingAssets for TraderWithYieldBearingAssets.Info;

  using SafeTransferLib for IERC20Minimal;

  IMarginEngine public override marginEngine;
  
  IVAMM internal vamm;
  IAaveV2LendingPool internal aaveLendingPool;
  IRateOracle internal rateOracle;

  address private deployer;

  IERC20Minimal internal underlyingToken;
  IERC20Minimal internal underlyingYieldBearingToken;

  mapping(address => TraderWithYieldBearingAssets.Info) public traders;

  /// The resulting margin does not meet minimum requirements
  error MarginRequirementNotMet();

  /// Positions and Traders cannot be settled before the applicable interest rate swap has matured 
  error CannotSettleBeforeMaturity();
  
  // can only be called by the marginEngine
  error OnlyMarginEngine();
  
  // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {  

      deployer = msg.sender; /// this is presumably the factory

  }
  
  /// @dev modifier which checks if the msg.sender is not equal to the address of the MarginEngine, if that's the case, a revert is raised
  modifier onlyMarginEngine () {
    if (msg.sender != address(marginEngine)) {
        revert OnlyMarginEngine();
    }
    _;
  }
  
  /// @dev in the initialize function we set the vamm and the margiEngine associated with the fcm
  function initialize(address _vammAddress, address _marginEngineAddress) external override initializer {
    /// @dev we additionally cache the rateOracle, aaveLendingPool, underlyingToken, underlyingYieldBearingToken
    vamm = IVAMM(_vammAddress);
    marginEngine = IMarginEngine(_marginEngineAddress);
    rateOracle = marginEngine.rateOracle();
    aaveLendingPool = IAaveV2LendingPool(IAaveRateOracle(address(rateOracle)).aaveLendingPool());
    address underlyingTokenAddress = address(marginEngine.underlyingToken());
    underlyingToken = IERC20Minimal(underlyingTokenAddress);
    AaveDataTypes.ReserveData memory aaveReserveData = aaveLendingPool.getReserveData(underlyingTokenAddress);
    underlyingYieldBearingToken = IERC20Minimal(aaveReserveData.aTokenAddress);

    __Ownable_init();
    __Pausable_init();
  }

  event InitiateFullyCollateralisedSwap(
    uint256 marginInScaledYieldBearingTokens,
    int256 fixedTokenBalance,
    int256 variableTokenBalance
  );
  

  /// @notice Initiate a Fully Collateralised Fixed Taker Swap
  /// @param notional Notional that cover by a fully collateralised fixed taker interest rate swap
  /// @param sqrtPriceLimitX96 The binary fixed point math representation of the sqrtPriceLimit beyond which the fixed taker swap will not be executed with the VAMM
  function initiateFullyCollateralisedFixedTakerSwap(uint256 notional, uint160 sqrtPriceLimitX96) external override {
    
    require(notional!=0, "notional = 0");
 
    /// add support for approvals and recipient (similar to how it is implemented in the MarginEngine)

    int24 tickSpacing = vamm.tickSpacing();

    // initiate a swap
    // the default tick range for a Position associated with the FCM is tickLower: -tickSpacing and tickUpper: tickSpacing
    // isExternal is true since the state updates following a VAMM insuced swap are done in the FCM (below)
    IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: address(this),
        amountSpecified: int256(notional),
        sqrtPriceLimitX96: sqrtPriceLimitX96,
        isExternal: true,
        tickLower: -tickSpacing,
        tickUpper: tickSpacing
    });

    (int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred,) = vamm.swap(params);

    // deposit notional executed in terms of aTokens (e.g. aUSDC) to fully collateralise your position
    underlyingYieldBearingToken.safeTransferFrom(msg.sender, address(this), uint256(-variableTokenDelta));

    TraderWithYieldBearingAssets.Info storage trader = traders[msg.sender];

    uint256 currentRNI = aaveLendingPool.getReserveNormalizedIncome(address(marginEngine.underlyingToken()));

    uint256 updatedTraderMargin = trader.marginInScaledYieldBearingTokens + uint256(-variableTokenDelta).rayDiv(currentRNI);
    trader.updateMarginInScaledYieldBearingTokens(updatedTraderMargin);
    
    // update trader fixed and variable token balances
    trader.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);

    // transfer fees to the margin engine (in terms of the underlyingToken e.g. aUSDC)
    underlyingToken.safeTransferFrom(msg.sender, address(marginEngine), cumulativeFeeIncurred);

    emit InitiateFullyCollateralisedSwap(trader.marginInScaledYieldBearingTokens, trader.fixedTokenBalance, trader.variableTokenBalance);

  }

  /// @notice Get Trader Margin In Yield Bearing Tokens
  /// @dev this function takes the scaledBalance associated with a trader and multiplies it by the current Reserve Normalised Income to get the balance (margin) in terms of the underlying token
  /// @param trader The TraderWithYieldBearingAssets.Info object that stores the data about the scaled tokens balances of the trader's margin account 
  function getTraderMarginInYieldBearingTokens(TraderWithYieldBearingAssets.Info storage trader) internal view returns (uint256 marginInYieldBearingTokens) {
    uint256 currentRNI = aaveLendingPool.getReserveNormalizedIncome(address(marginEngine.underlyingToken()));
    marginInYieldBearingTokens = trader.marginInScaledYieldBearingTokens.rayMul(currentRNI);
  }


  /// @notice Unwind Fully Collateralised Fixed Taker Swap
  /// @param notionalToUnwind The amount of notional to unwind (stop securing with a fixed rate)
  /// @param sqrtPriceLimitX96 The sqrt price limit (binary fixed point notation) beyond which the unwind cannot progress
  function unwindFullyCollateralisedFixedTakerSwap(uint256 notionalToUnwind, uint160 sqrtPriceLimitX96) external override {
    
    // add require statement and isApproval
    
    TraderWithYieldBearingAssets.Info storage trader = traders[msg.sender];

    /// @dev it is impossible to unwind more variable token exposure than the user already has
    /// @dev hencel, the notionalToUnwind needs to be <= absolute value of the variable token balance of the trader
    require(uint256(-trader.variableTokenBalance) >= notionalToUnwind, "notional to unwind > notional");

    /// retrieve the tick spacing of the VAMM
    int24 tickSpacing = vamm.tickSpacing();

    // initiate a swap
    /// @dev as convention, specify the tickLower to be equal to -tickSpacing and tickUpper to be equal to tickSpacing
    // since the unwind is in the Variable Taker direction, the amountSpecified needs to be exact output => needs to be negative = -int256(notionalToUnwind),
    IVAMM.SwapParams memory params = IVAMM.SwapParams({
        recipient: address(this),
        amountSpecified: -int256(notionalToUnwind),
        sqrtPriceLimitX96: sqrtPriceLimitX96,
        isExternal: true,
        tickLower: -tickSpacing,
        tickUpper: tickSpacing
    });

    (int256 fixedTokenDelta, int256 variableTokenDelta, uint256 cumulativeFeeIncurred,) = vamm.swap(params);
        
    // update trader fixed and variable token balances
    
    trader.updateBalancesViaDeltas(fixedTokenDelta, variableTokenDelta);

    // transfer fees to the margin engine
    underlyingToken.safeTransferFrom(msg.sender, address(marginEngine), cumulativeFeeIncurred);

    // transfer the yield bearing tokens to trader address and update margin in terms of yield bearing tokens
    // variable token delta should be positive
    underlyingYieldBearingToken.safeTransfer(msg.sender, uint256(variableTokenDelta));

    uint256 currentRNI = aaveLendingPool.getReserveNormalizedIncome(address(underlyingToken));

    uint256 updatedTraderMargin = trader.marginInScaledYieldBearingTokens - uint256(variableTokenDelta).rayDiv(currentRNI);
    trader.updateMarginInScaledYieldBearingTokens(updatedTraderMargin);

    // check the margin requirement of the trader post unwind, if the current balances still support the unwind, they it can happen, otherwise the unwind will get reverted
    checkMarginRequirement(trader);

  }

  
  /// @notice Check Margin Requirement post unwind of a fully collateralised fixed taker
  function checkMarginRequirement(TraderWithYieldBearingAssets.Info storage trader) internal {
  
    // variable token balance should never be positive
    // margin in scaled tokens should cover the variable leg from now to maturity

    /// @dev we can be confident the variable token balance of a fully collateralised fixed taker is always going to be negative (or zero)
    /// @dev hence, we can assume that the variable cashflows from now to maturity is covered by a portion of the trader's collateral in yield bearing tokens 
    /// @dev one future variable cashflows are covered, we need to check if the remaining settlement cashflow is covered by the remaining margin in yield bearing tokens

    uint256 marginToCoverVariableLegFromNowToMaturity = uint256(trader.variableTokenBalance);
    uint256 marginToCoverRemainingSettlementCashflow = getTraderMarginInYieldBearingTokens(trader) - marginToCoverVariableLegFromNowToMaturity;

    int256 remainingSettlementCashflow = calculateRemainingSettlementCashflow(trader);

    if (remainingSettlementCashflow < 0) {
    
      if (uint256(-remainingSettlementCashflow) > marginToCoverRemainingSettlementCashflow) {
        revert MarginRequirementNotMet();
      }
    
    }

  }


  /// @notice Calculate remaining settlement cashflow
  function calculateRemainingSettlementCashflow(TraderWithYieldBearingAssets.Info storage trader) internal returns (int256 remainingSettlementCashflow) {
    
    int256 fixedTokenBalanceWad = PRBMathSD59x18.fromInt(trader.fixedTokenBalance);
    
    int256 variableTokenBalanceWad = PRBMathSD59x18.fromInt(
        trader.variableTokenBalance
    );

    /// @dev fixed cashflow based on the full term of the margin engine
    int256 fixedCashflowWad = PRBMathSD59x18.mul(
      fixedTokenBalanceWad,
      int256(
        FixedAndVariableMath.fixedFactor(true, marginEngine.termStartTimestampWad(), marginEngine.termEndTimestampWad())
      )
    );

    int256 variableFactorFromTermStartTimestampToNow = int256(rateOracle.variableFactor(
      marginEngine.termStartTimestampWad(),
      marginEngine.termEndTimestampWad()
    ));
    
    /// @dev variable cashflow based on the term from start to now since the cashflow from now to maturity is fully collateralised by the yield bearing tokens
    int256 variableCashflowWad = PRBMathSD59x18.mul(
      variableTokenBalanceWad,
      variableFactorFromTermStartTimestampToNow
    );

    /// @dev the total cashflows as a sum of fixed and variable cashflows
    int256 cashflowWad = fixedCashflowWad + variableCashflowWad;

    /// @dev convert back to non-fixed point representation
    remainingSettlementCashflow = PRBMathSD59x18.toInt(cashflowWad);

  }
    
  modifier onlyAfterMaturity () {
    if (marginEngine.termEndTimestampWad() > Time.blockTimestampScaled()) {
        revert CannotSettleBeforeMaturity();
    }
    _;
  }

  /// @notice Settle Trader
  /// @dev This function lets us settle a fully collateralised fixed taker position post term end timestamp of the MarginEngine
  /// @dev the settlement cashflow is calculated by invoking the calculateSettlementCashflow function of FixedAndVariableMath.sol (based on the fixed and variable token balance)
  /// @dev if the settlement cashflow of the trader is positive, then the settleTrader() function invokes the transferMarginToFCMTrader function of the MarginEngine which transfers the settlement cashflow the trader in terms of the underlying tokens
  /// @dev if settlement cashflow of the trader is negative, we need to update trader's margin in terms of scaled yield bearing tokens to account the settlement casflow
  /// @dev once settlement cashflows are accounted for, we safeTransfer the scaled yield bearing tokens in the margin account of the trader back to their wallet address
  function settleTrader() external override onlyAfterMaturity { 
    
    TraderWithYieldBearingAssets.Info storage trader = traders[msg.sender];
    require(!trader.isSettled, "not settled");
    
    int256 settlementCashflow = FixedAndVariableMath.calculateSettlementCashflow(trader.fixedTokenBalance, trader.variableTokenBalance, marginEngine.termStartTimestampWad(), marginEngine.termEndTimestampWad(), rateOracle.variableFactor(marginEngine.termStartTimestampWad(), marginEngine.termEndTimestampWad()));
    trader.updateBalancesViaDeltas(-trader.fixedTokenBalance, -trader.variableTokenBalance);
    
    if (settlementCashflow > 0) {
      // transfers margin in terms of underlying tokens (e.g. USDC) from 
      marginEngine.transferMarginToFCMTrader(msg.sender, uint256(settlementCashflow));
    } else {
      uint256 currentRNI = aaveLendingPool.getReserveNormalizedIncome(address(marginEngine.underlyingToken()));
      uint256 updatedTraderMarginInScaledYieldBearingTokens = trader.marginInScaledYieldBearingTokens - uint256(-settlementCashflow).rayDiv(currentRNI);
      trader.updateMarginInScaledYieldBearingTokens(updatedTraderMarginInScaledYieldBearingTokens);
    }

    // if settlement happens late, additional variable yield beyond maturity will accrue to the trader

    uint256 traderMarginInYieldBearingTokens = getTraderMarginInYieldBearingTokens(trader);
    trader.updateMarginInScaledYieldBearingTokens(0);    
    underlyingYieldBearingToken.safeTransfer(msg.sender, traderMarginInYieldBearingTokens);
    trader.settleTrader();
  }


  /// @notice Transfer Margin (in underlying tokens) from the FCM to a MarginEngine trader
  /// @dev in case of aave this is done by withdrawing aTokens from the aaveLendingPools resulting in burning of the aTokens in exchange for the ability to transfer underlying tokens to the margin engine trader
  function transferMarginToMarginEngineTrader(address _account, uint256 marginDeltaInUnderlyingTokens) external onlyMarginEngine override {
    /// if aave's reserves are depleted the withdraw operation below will fail, in that scenario need to either withdraw as much as possible or transfer aTokens directly
    aaveLendingPool.withdraw(address(underlyingToken), marginDeltaInUnderlyingTokens, _account);
  }


}