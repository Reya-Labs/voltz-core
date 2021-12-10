// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IFactory.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./Deployer.sol";
import "./VAMM.sol";
import "./core_libraries/FixedAndVariableMath.sol";

// todo: introduce VoltzData.sol that is above the Factory?


/// @title Canonical Voltz factory
/// @notice Deploys Voltz AMMs and manages ownership and control over amm protocol fees
contract Factory is IFactory, Deployer {
  mapping(bytes32 => address) public override getRateOracleAddress;
  address public override owner;
  // mapping(uint24 => int24) public override feeAmountTickSpacing;
  mapping(bytes32 => mapping(address => mapping(uint256 => mapping(uint256 => address))))
    public getAMMMAp; // todo: make edits to the mapping

  address public override treasury;

  address public override insuranceFund;

  address public override calculator;

  // constructor(address _treasury, address _insuranceFund) {
  constructor() {
    // don't really need to set the treasury and the insurance fund at the construction
    // require(_treasury != address(0), "ZERO_ADDRESS");
    // require(_insuranceFund != address(0), "ZERO_ADDRESS");
    // treasury = _treasury;
    // insuranceFund = _insuranceFund;

    owner = msg.sender;
    emit OwnerChanged(address(0), msg.sender);

    // feeAmountTickSpacing[500] = 10; // todo: why different fee amounts for each tick spacing?
    // emit FeeAmountEnabled(500, 10);
    // feeAmountTickSpacing[3000] = 60;
    // emit FeeAmountEnabled(3000, 60);
    // feeAmountTickSpacing[10000] = 200;
    // emit FeeAmountEnabled(10000, 200);
  }

  function setTreasury(address _treasury) external override {
    require(_treasury != address(0), "ZERO_ADDRESS");

    treasury = _treasury;

    // emit treasury set
  }

  function setCalculator(address _calculator) external override {
    require(_calculator != address(0), "ZERO_ADDRESS");

    calculator = _calculator;

    // emit calculator set
  }

  function setInsuranceFund(address _insuranceFund) external override {
    require(_insuranceFund != address(0), "ZERO_ADDRESS");

    insuranceFund = _insuranceFund;

    // emit insurance fund set
  }


  function createVAMM(
        address ammAddress
  ) external override returns (address vamm) {
    require(ammAddress != address(0));
    
    vamm = deployVAMM(ammAddress);

    // todo: separate mapping for vamms? to query by ammAddress.
    return vamm;
  }

  function createMarginEngine(
    address ammAddress
  ) external override returns (address marginEngine) {
    require(ammAddress != address(0));

    marginEngine = deployMarginEngine(ammAddress);

    // todo: separate mapping for marginEngines? to query by amm address.

    return marginEngine;

  }

  function createAMM(
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termEndTimestamp
  ) external override returns (address amm) {
    
    uint256 termStartTimestamp = FixedAndVariableMath.blockTimestampScaled();
    require(
      getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][termEndTimestamp] == address(0)
    );

    amm = deployAMM(address(this), underlyingToken, rateOracleId, termStartTimestamp, termEndTimestamp);

    getAMMMAp[rateOracleId][underlyingToken][termStartTimestamp][termEndTimestamp] = amm;

    // todo: emit amm created

  }


  function setOwner(address _owner) external override {
    require(msg.sender == owner);
    emit OwnerChanged(owner, _owner);
    owner = _owner;
  }

  // todo: don't need this since can directly set the fee proportion via the multisig
  // function enableFeeAmount(uint24 fee, int24 tickSpacing) public override {

  // todo initialised, onlyGovernance
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
