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

  using Clones for address;
  
  address public override masterMarginEngine;
  address public override masterVAMM;

  constructor(address _masterMarginEngine, address _masterVAMM) {
    masterMarginEngine = _masterMarginEngine;
    masterVAMM = _masterVAMM;
  }

  function createVAMM(bytes32 salt) external override {
    masterVAMM.cloneDeterministic(salt);
  }

  function createMarginEngine(bytes32 salt) external override {
    masterMarginEngine.cloneDeterministic(salt);
  }

  function getVAMMAddress(bytes32 salt) external view override returns (address) {
    require(masterVAMM != address(0), "master VAMM must be set");
    return masterVAMM.predictDeterministicAddress(salt);
  }

  function getMarginEngineAddress(bytes32 salt) external view override returns (address) {
    require(masterMarginEngine != address(0), "master MarginEngine must be set");
    return masterMarginEngine.predictDeterministicAddress(salt);
  }
}
