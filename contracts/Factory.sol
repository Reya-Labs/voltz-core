// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Voltz Factory Contract
/// @notice Deploys Voltz VAMMs and MarginEngines and manages ownership and control over amm protocol fees
// Following this example https://github.com/OriginProtocol/minimal-proxy-example/blob/master/contracts/PairFactory.sol
contract Factory is IFactory, Ownable {

<<<<<<< HEAD
  /// @inheritdoc IFactory
  address public override owner;

  /// @inheritdoc IFactory
  mapping(address => mapping(address => mapping(uint256 => mapping(uint256 => address))))
    public
    override getAMMMap;
  
  /// @inheritdoc IFactory
  mapping(address => address) public override getVAMMMap;

  /// @inheritdoc IFactory
  mapping(address => address) public override getMarginEngineMap;

  /// @inheritdoc IFactory
  address public override calculator;

  constructor() {
    owner = msg.sender;
    emit OwnerChanged(address(0), msg.sender);
=======
  using Clones for address;
  
  address public override masterMarginEngine;
  address public override masterVAMM;

  constructor(address _masterMarginEngine, address _masterVAMM) {
    masterMarginEngine = _masterMarginEngine;
    masterVAMM = _masterVAMM;
>>>>>>> ammRefactoring
  }

  function createVAMM(bytes32 salt) external override {
    masterVAMM.cloneDeterministic(salt);
  }

  function createMarginEngine(bytes32 salt) external override {
    masterMarginEngine.cloneDeterministic(salt);
  }

<<<<<<< HEAD
  /// @inheritdoc IFactory
  function createMarginEngine(address ammAddress)
    external
    override
    onlyFactoryOwner
    returns (address marginEngine)
  {
    require(ammAddress != address(0), "ZERO_ADDRESS");
    require(getMarginEngineMap[ammAddress] == address(0), "EXISTED_MargineEngine");

    marginEngine = deployMarginEngine(ammAddress);

    return marginEngine;
  }

  /// @inheritdoc IFactory
  function createAMM(
    address underlyingToken,
    address rateOracleAddress,
    uint256 termEndTimestamp
  ) external override onlyFactoryOwner returns (address amm) {
    uint256 termStartTimestamp = Time.blockTimestampScaled(); 
    require(
      getAMMMap[rateOracleAddress][underlyingToken][termStartTimestamp][
        termEndTimestamp
      ] == address(0),
      "EXISTED_AMM"
    );

    amm = deployAMM(
      address(this),
      underlyingToken,
      rateOracleAddress,
      termStartTimestamp,
      termEndTimestamp
    );

    getAMMMap[rateOracleAddress][underlyingToken][termStartTimestamp][
      termEndTimestamp
    ] = amm;

    emit AMMCreated(
      amm,
      underlyingToken,
      rateOracleAddress,
      termStartTimestamp,
      termEndTimestamp
    );
=======
  function getVAMMAddress(bytes32 salt) external view override returns (address) {
    require(masterVAMM != address(0), "master VAMM must be set");
    return masterVAMM.predictDeterministicAddress(salt);
>>>>>>> ammRefactoring
  }

  function getMarginEngineAddress(bytes32 salt) external view override returns (address) {
    require(masterMarginEngine != address(0), "master MarginEngine must be set");
    return masterMarginEngine.predictDeterministicAddress(salt);
  }
<<<<<<< HEAD
=======

>>>>>>> ammRefactoring
}
