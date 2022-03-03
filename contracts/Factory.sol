// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./interfaces/fcms/IFCM.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Voltz Factory Contract
/// @notice Deploys Voltz VAMMs and MarginEngines and manages ownership and control over amm protocol fees
// Following this example https://github.com/OriginProtocol/minimal-proxy-example/blob/master/contracts/PairFactory.sol
contract Factory is IFactory, Ownable {

  /// AB: add option to change the masterMarginEngine and masterVAMM (upgradability)?
  using Clones for address;
  
  address public override masterMarginEngine;
  address public override masterVAMM;
  mapping(uint8 => address) public override masterFCMs;
  mapping(address => mapping(address => bool)) private _approvals;

  function setApproval(address intAddress, bool allowIntegration) external override {
    _approvals[msg.sender][intAddress] = allowIntegration;
  }
  
  function isApproved(address _owner, address intAddress) external override view returns (bool) {
    return _approvals[_owner][intAddress];
  }

  constructor(address _masterMarginEngine, address _masterVAMM) {
    masterMarginEngine = _masterMarginEngine;
    masterVAMM = _masterVAMM;
  }

  function setMasterFCM(address masterFCMAddress, address _rateOracle) external override onlyOwner {
    
    require(_rateOracle != address(0), "rate oracle must exist");
    require(masterFCMAddress != address(0), "master fcm must exist");

    uint8 yieldBearingProtocolID = IRateOracle(_rateOracle).underlyingYieldBearingProtocolID();
    address masterFCMAddressOld = masterFCMs[yieldBearingProtocolID];
    masterFCMs[yieldBearingProtocolID] = masterFCMAddress;
    emit MasterFCMSet(masterFCMAddressOld, masterFCMAddress, yieldBearingProtocolID);
  }

  function getSalt(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) internal pure returns (bytes32 salt) {
    return keccak256(abi.encode(_underlyingToken, _rateOracle,  _termStartTimestampWad, _termEndTimestampWad, _tickSpacing));
  }

  function getVAMMAddress(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) external view override returns (address) {
    require(masterVAMM != address(0), "master VAMM must be set");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, _tickSpacing);
    return masterVAMM.predictDeterministicAddress(salt);
  }

  function getMarginEngineAddress(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) external view override returns (address) {
    require(masterMarginEngine != address(0), "master MarginEngine must be set");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, _tickSpacing);
    return masterMarginEngine.predictDeterministicAddress(salt);
  }

  function getFCMAddress(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) external view override returns (address) {
    uint8 yieldBearingProtocolID = IRateOracle(_rateOracle).underlyingYieldBearingProtocolID();
    require(masterFCMs[yieldBearingProtocolID] != address(0), "master FCM must be set");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, _tickSpacing);
    return masterFCMs[yieldBearingProtocolID].predictDeterministicAddress(salt);
  }

  function deployIrsInstance(address _underlyingToken, address _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) external override onlyOwner returns (address marginEngineProxy, address vammProxy, address fcmProxy) {
    // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
    // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick
    // 16384 ticks represents a >5x price change with ticks of 1 bips
    require(_tickSpacing > 0 && _tickSpacing < 16384, "TSOOB");
    bytes32 salt = getSalt(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, _tickSpacing);
    IMarginEngine marginEngine = IMarginEngine(masterMarginEngine.cloneDeterministic(salt));
    IVAMM vamm = IVAMM(masterVAMM.cloneDeterministic(salt));
    marginEngine.initialize(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    vamm.initialize(address(marginEngine), _tickSpacing);
    marginEngine.setVAMM(address(vamm));

    uint8 yieldBearingProtocolID = IRateOracle(_rateOracle).underlyingYieldBearingProtocolID();
    IFCM fcm;
    
    if (masterFCMs[yieldBearingProtocolID] != address(0)) {
      address masterFCM = masterFCMs[yieldBearingProtocolID];
      fcm = IFCM(masterFCM.cloneDeterministic(salt));
      fcm.initialize(address(vamm), address(marginEngine));
      marginEngine.setFCM(address(fcm));
      Ownable(address(fcm)).transferOwnership(msg.sender);
    }

    emit IrsInstanceDeployed(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad, _tickSpacing, address(marginEngine), address(vamm), address(fcm), yieldBearingProtocolID);

    // Transfer ownership of all instances to the factory owner
    Ownable(address(vamm)).transferOwnership(msg.sender);
    Ownable(address(marginEngine)).transferOwnership(msg.sender);

    return(address(marginEngine), address(vamm), address(fcm));
  }



}

