// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./Deployer.sol";

/// @title Voltz Factory Contract
/// @notice Deploys Voltz AMMs and manages ownership and control over amm protocol fees
contract Factory is IFactory, Deployer {
  
  modifier onlyFactoryOwner {
    require(msg.sender == owner, "NOT_OWNER");
    _;
  }

  /// @inheritdoc IFactory
  address public override owner;

  /// @inheritdoc IFactory
  mapping(bytes32 => mapping(address => mapping(uint256 => mapping(uint256 => address))))
    public
    override getMarginEngineMap;
  
  /// @inheritdoc IFactory
  mapping(address => address) public override getVAMMMap;

  /// @inheritdoc IFactory
  mapping(bytes32 => address) public override getRateOracleAddress;

  constructor() {
    owner = msg.sender;
    emit OwnerChanged(address(0), msg.sender);
  }

  /// @inheritdoc IFactory
  function createVAMM(address marginEngineAddress)
    external
    override
    onlyFactoryOwner
    returns (address vamm)
  {
    require(marginEngineAddress != address(0), "ZERO_ADDRESS");
    require(getVAMMMap[marginEngineAddress] == address(0), "EXISTED_VAMM");

    vamm = deployVAMM(marginEngineAddress);

    return vamm;
  }

  /// @inheritdoc IFactory
  function createMarginEngine(
    address underlyingToken,
    bytes32 rateOracleId,
    uint256 termEndTimestamp)
    external
    override
    onlyFactoryOwner
    returns (address marginEngine)
  {
    uint256 termStartTimestamp = Time.blockTimestampScaled(); 
    require(
      getMarginEngineMap[rateOracleId][underlyingToken][termStartTimestamp][
        termEndTimestamp
      ] == address(0),
      "EXISTED_AMM"
    );

    marginEngine = deployMarginEngine(
      address(this),
      underlyingToken,
      rateOracleId,
      termStartTimestamp,
      termEndTimestamp);

    // emit margin engine created

    return marginEngine;
  }

  /// @inheritdoc IFactory
  function setOwner(address _owner) external override onlyFactoryOwner {
    emit OwnerChanged(owner, _owner);
    owner = _owner;
  }

  /// @inheritdoc IFactory
  function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress)
    external
    override
    onlyFactoryOwner
  {
    require(_rateOracleId != bytes32(0), "ZERO_BYTES");
    require(_rateOracleAddress != address(0), "ZERO_ADDRESS");
    require(
      _rateOracleId == IRateOracle(_rateOracleAddress).rateOracleId(),
      "INVALID_ID"
    );
    require(getRateOracleAddress[_rateOracleId] == address(0), "EXISTED_ID");

    emit RateOracleAdded(_rateOracleId, _rateOracleAddress);

    getRateOracleAddress[_rateOracleId] = _rateOracleAddress;
  }
}
