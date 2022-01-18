// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces//IMarginEngine.sol";
import "./interfaces//IVAMM.sol";
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

  function getSalt(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad) internal pure returns (bytes32 salt) {
    return keccak256(abi.encode(_underlyingToken, _rateOracle,  _termStartTimestampWad, _termEndTimestampWad));
  }

  function getVAMMAddress(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad) external view override returns (address) {
    require(masterVAMM != address(0), "master VAMM must be set");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    return masterVAMM.predictDeterministicAddress(salt);
  }

  function getMarginEngineAddress(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad) external view override returns (address) {
    require(masterMarginEngine != address(0), "master MarginEngine must be set");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    return masterMarginEngine.predictDeterministicAddress(salt);
  }

  function deployIrsInstance(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad) external override returns (address marginEngineProxy, address vammProxy) {
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    IMarginEngine marginEngine = IMarginEngine(masterMarginEngine.cloneDeterministic(salt));
    IVAMM vamm = IVAMM(masterVAMM.cloneDeterministic(salt));
    marginEngine.initialize(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    vamm.initialize(address(marginEngine));
    emit IrsInstanceDeployed(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, address(marginEngine), address(vamm));
    return(address(marginEngine), address(vammProxy));
  }
}

