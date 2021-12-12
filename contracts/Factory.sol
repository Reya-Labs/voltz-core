// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IFactory.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./Deployer.sol";
import "./VAMM.sol";
import "./core_libraries/FixedAndVariableMath.sol";

/// @title Voltz Factory Contract
/// @notice Deploys Voltz AMMs and manages ownership and control over amm protocol fees
contract Factory is IFactory, Deployer {
  /// @inheritdoc IFactory
  address public override owner;

  /// @inheritdoc IFactory
  mapping(bytes32 => mapping(address => mapping(uint256 => mapping(uint256 => address))))
    public
    override getAMMMAp;

  /// @inheritdoc IFactory
  mapping(bytes32 => address) public override getRateOracleAddress;

  /// @inheritdoc IFactory
  address public override treasury;

  /// @inheritdoc IFactory
  address public override insuranceFund;

  /// @inheritdoc IFactory
  address public override calculator;

  constructor() {
    // don't really need to set the treasury and the insurance fund at the construction
    owner = msg.sender;
    emit OwnerChanged(address(0), msg.sender);
  }

  /// @inheritdoc IFactory
  function setTreasury(address _treasury) external override {
    require(_treasury != address(0), "ZERO_ADDRESS");

    treasury = _treasury;

    // emit treasury set
  }

  /// @inheritdoc IFactory
  function setCalculator(address _calculator) external override {
    require(_calculator != address(0), "ZERO_ADDRESS");

    calculator = _calculator;

    // emit calculator set
  }

  /// @inheritdoc IFactory
  function setInsuranceFund(address _insuranceFund) external override {
    require(_insuranceFund != address(0), "ZERO_ADDRESS");

    insuranceFund = _insuranceFund;

    // emit insurance fund set
  }

  /// @inheritdoc IFactory
  function createVAMM(address ammAddress)
    external
    override
    returns (address vamm)
  {
    require(ammAddress != address(0));

    vamm = deployVAMM(ammAddress);

    return vamm;
  }

  /// @inheritdoc IFactory
  function createMarginEngine(address ammAddress)
    external
    override
    returns (address marginEngine)
  {
    require(ammAddress != address(0));

    marginEngine = deployMarginEngine(ammAddress);

    return marginEngine;
  }

  /// @inheritdoc IFactory
  function createAMM(
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termEndTimestamp
  ) external override returns (address amm) {
    uint256 termStartTimestamp = Time.blockTimestampScaled();
    require(
      getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][
        termEndTimestamp
      ] == address(0)
    );

    amm = deployAMM(
      address(this),
      underlyingToken,
      rateOracleId,
      termStartTimestamp,
      termEndTimestamp
    );

    getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][
      termEndTimestamp
    ] = amm;

    // todo: emit amm created
  }

  /// @inheritdoc IFactory
  function setOwner(address _owner) external override {
    require(msg.sender == owner);
    emit OwnerChanged(owner, _owner);
    owner = _owner;
  }

  /// @inheritdoc IFactory
  function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress)
    external
    override
  {
    require(_rateOracleId != bytes32(0), "ZERO_BYTES");
    require(_rateOracleAddress != address(0), "ZERO_ADDRESS");
    require(
      _rateOracleId == IRateOracle(_rateOracleAddress).rateOracleId(),
      "INVALID_ID"
    );
    require(getRateOracleAddress[_rateOracleId] == address(0), "EXISTED_ID");

    getRateOracleAddress[_rateOracleId] = _rateOracleAddress;

    // todo: emit RateOracleAdded
  }
}
