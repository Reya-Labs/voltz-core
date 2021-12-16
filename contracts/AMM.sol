// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "./core_libraries/Tick.sol";
import "./interfaces/IDeployer.sol";
import "./interfaces/IAMM.sol";
import "./core_libraries/TickBitmap.sol";
import "./core_libraries/Position.sol";
import "./core_libraries/Trader.sol";

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

import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";

contract AMM is IAMM, Pausable {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;

  using Position for mapping(bytes32 => Position.Info);
  using Position for Position.Info;

  using Trader for mapping(bytes32 => Trader.Info);
  using Trader for Trader.Info;

  address public override factory;

  address public immutable override underlyingToken;

  bytes32 public override rateOracleId;

  uint256 public immutable override termStartTimestamp;

  uint256 public immutable override termEndTimestamp;

  IMarginCalculator public override calculator;

  IRateOracle public override rateOracle;

  IVAMM public override vamm;
  IMarginEngine public override marginEngine;
  bool public override unlocked;

  constructor() Pausable() {
    (
      factory,
      underlyingToken,
      rateOracleId,
      termStartTimestamp,
      termEndTimestamp
    ) = IDeployer(msg.sender).ammParameters();

    // setting rate oracle separately
    // set the calculator in the factory since it is persistent
  }

  modifier onlyFactoryOwner() {
    require(IFactory(factory).owner() != address(0));
    require(msg.sender == IFactory(factory).owner());
    _;
  }

  modifier onlyVAMM() {
    require(address(vamm) != address(0));
    require(msg.sender == address(vamm));
    _;
  }

  /// @dev Mutually exclusive reentrancy protection into the vamm to/from a method. This method also prevents entrance
  /// to a function before the pool is initialized. The reentrancy guard is required throughout the contract because
  /// we use balance checks to determine the payment status of interactions such as mint, swap and flash.
  modifier lock() {
    require(unlocked, "LOK");
    unlocked = false;
    _;
    unlocked = true;
  }

  function getSlot0() external view override returns (IVAMM.Slot0 memory) {
    (uint160 sqrtPriceX96, int24 tick, uint256 feeProtocol) = vamm.slot0();

    return
      IVAMM.Slot0({
        sqrtPriceX96: sqrtPriceX96,
        tick: tick,
        feeProtocol: feeProtocol
      });
  }
  
  function getVariableTokenGrowthGlobal()
    external
    view
    override
    returns (int256)
  {
    return vamm.variableTokenGrowthGlobal();
  }

  function getFixedTokenGrowthGlobal() external view override returns (int256) {
    return vamm.fixedTokenGrowthGlobal();
  }


  function setRateOracle(address _rateOracleAddress) external override onlyFactoryOwner {
    // reference to how you can extract the rateOracleAddress via its rateOracleId key
    // address rateOracleAddress = IFactory(factory).getRateOracleAddress(
    //   rateOracleId
    // );
    rateOracle = IRateOracle(_rateOracleAddress);
  }


  function setVAMM(address _vAMMAddress) external override onlyFactoryOwner {
    vamm = IVAMM(_vAMMAddress);
  }

  function setMarginEngine(address _marginEngine)
    external
    override
    onlyFactoryOwner
  {
    marginEngine = IMarginEngine(_marginEngine);
  }

  function setUnlocked(bool _unlocked) external override onlyVAMM {
    unlocked = _unlocked;
  }

  function updatePositionMargin(
    IMarginEngine.ModifyPositionParams memory params,
    int256 marginDelta
  ) external override {
    marginEngine.updatePositionMargin(params, marginDelta);
  }

  function updateTraderMargin(address recipient, int256 marginDelta)
    external
    override
  {
    marginEngine.updateTraderMargin(recipient, marginDelta);
  }

  function settlePosition(IMarginEngine.ModifyPositionParams memory params)
    external
    override
  {
    marginEngine.settlePosition(params);
  }

  function settleTrader(address recipient) external override {
    marginEngine.settleTrader(recipient);
  }

  function liquidatePosition(IMarginEngine.ModifyPositionParams memory params)
    external
    override
    whenNotPaused
  {
    marginEngine.liquidatePosition(params);
  }

  function liquidateTrader(address traderAddress)
    external
    override
    whenNotPaused
  {
    marginEngine.liquidateTrader(traderAddress);
  }

  function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override lock {
    vamm.burn(tickLower, tickUpper, amount);
  }

  function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override whenNotPaused lock {
    vamm.mint(recipient, tickLower, tickUpper, amount);
  }

  function swap(IVAMM.SwapParams memory params)
    external
    override
    whenNotPaused
    lock
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
  {
    (_fixedTokenDelta, _variableTokenDelta) = vamm.swap(params);
  }

  function setFeeProtocol(uint256 feeProtocol)
    external
    override
    lock
    onlyFactoryOwner
  {
    vamm.setFeeProtocol(feeProtocol);
  }

  function collectProtocol(address recipient)
    external
    override
    lock
    onlyFactoryOwner
    returns (uint256 amount)
  {
    if (amount > 0) {
      vamm.updateProtocolFees(amount);
      IERC20Minimal(underlyingToken).transferFrom(
        address(this),
        recipient,
        amount
      );
    }

    // emit collect protocol event
  }
}
