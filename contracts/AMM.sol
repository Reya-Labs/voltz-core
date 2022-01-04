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

import "./core_libraries/FixedAndVariableMath.sol";

import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";

contract AMM is IAMM {
  using LowGasSafeMath for uint256;
  using LowGasSafeMath for int256;

  address public override factory;

  address public immutable override underlyingToken;

  bytes32 public override rateOracleId;

  uint256 public immutable override termStartTimestamp;

  uint256 public immutable override termEndTimestamp;

  IMarginCalculator public override calculator;

  IRateOracle public override rateOracle;

  IVAMM public override vamm;
  IMarginEngine public override marginEngine;
  

  constructor() {
    (
      factory,
      underlyingToken,
      rateOracleId,
      termStartTimestamp,
      termEndTimestamp
    ) = IDeployer(msg.sender).ammParameters();

    address rateOracleAddress = IFactory(factory).getRateOracleAddress(
      rateOracleId
    );

    rateOracle = IRateOracle(rateOracleAddress);

    address calculatorAddress = IFactory(factory).calculator();

    calculator = IMarginCalculator(calculatorAddress);
  }

  /// @dev Sender must be the Factory owner
  error SenderNotFactoryOwner();

  modifier onlyFactoryOwner() {
    if (msg.sender != IFactory(factory).owner()) {
      revert SenderNotFactoryOwner();
    }
    _;
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

  function updatePositionMargin(
    IMarginEngine.ModifyPositionParams memory params,
    int256 marginDelta
  ) external override {
    marginEngine.updatePositionMargin(params, marginDelta);
  }

  function updateTraderMargin(int256 marginDelta)
    external
    override
  {
    marginEngine.updateTraderMargin(marginDelta);
  }

  function settlePosition(IMarginEngine.ModifyPositionParams memory params)
    external
    override
  {
    marginEngine.settlePosition(params);
  }

  function settleTrader() external override { 
    marginEngine.settleTrader();
  }

  function liquidatePosition(IMarginEngine.ModifyPositionParams memory params)
    external
    override
  {
    marginEngine.liquidatePosition(params);
  }

  function liquidateTrader(address traderAddress)
    external
    override
  {
    marginEngine.liquidateTrader(traderAddress);
  }

  function burn(
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override {
    vamm.burn(tickLower, tickUpper, amount);
  }

  function mint(
    address recipient,
    int24 tickLower,
    int24 tickUpper,
    uint128 amount
  ) external override {
    vamm.mint(recipient, tickLower, tickUpper, amount);
  }

  function swap(IVAMM.SwapParams memory params)
    external
    override
    returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
  {
    (_fixedTokenDelta, _variableTokenDelta) = vamm.swap(params);
  }

  function setFeeProtocol(uint256 feeProtocol)
    external
    override
  {
    vamm.setFeeProtocol(feeProtocol);
  }

  function collectProtocol(address recipient)
    external
    override
    onlyFactoryOwner
    returns (uint256 amount)
  {
    if (amount > 0) {
      vamm.updateProtocolFees(amount);
      IERC20Minimal(underlyingToken).transfer(
        recipient,
        amount
      );
    }

    // emit collect protocol event
  }
}
