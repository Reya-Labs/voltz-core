// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFactory.sol";
import "./interfaces/rate_oracles/IRateOracle.sol";
import "./interfaces/IMarginEngine.sol";
import "./interfaces/IVAMM.sol";
import "./interfaces/fcms/IFCM.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "contracts/utils/CustomErrors.sol";

contract VoltzERC1967Proxy is ERC1967Proxy, CustomErrors {
  constructor(address _logic, bytes memory _data) payable ERC1967Proxy(_logic, _data) {}
}


/// @title Voltz Factory Contract
/// @notice Deploys Voltz VAMMs and MarginEngines and manages ownership and control over amm protocol fees
// Following this example https://github.com/OriginProtocol/minimal-proxy-example/blob/master/contracts/PairFactory.sol
contract Factory is IFactory, Ownable {
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

  function deployIrsInstance(IERC20Minimal _underlyingToken, IRateOracle _rateOracle, uint256 _termStartTimestampWad, uint256 _termEndTimestampWad, int24 _tickSpacing) external override onlyOwner returns (address marginEngineProxy, address vammProxy, address fcmProxy) {
    // tick spacing is capped at 16384 to prevent the situation where tickSpacing is so large that
    // TickBitmap#nextInitializedTickWithinOneWord overflows int24 container from a valid tick
    // 16384 ticks represents a >5x price change with ticks of 1 bips
    require(_tickSpacing > 0 && _tickSpacing < 16384, "TSOOB");
    IMarginEngine marginEngine = IMarginEngine(address(new VoltzERC1967Proxy(masterMarginEngine, "")));
    IVAMM vamm = IVAMM(address(new VoltzERC1967Proxy(masterVAMM, "")));
    marginEngine.initialize(_underlyingToken, _rateOracle, _termStartTimestampWad, _termEndTimestampWad);
    vamm.initialize(address(marginEngine), _tickSpacing);
    marginEngine.setVAMM(address(vamm));

    IRateOracle r = IRateOracle(_rateOracle);
    require(r.underlying() == address(_underlyingToken), "Tokens do not match");
    uint8 yieldBearingProtocolID = r.underlyingYieldBearingProtocolID();
    IFCM fcm;
    
    if (masterFCMs[yieldBearingProtocolID] != address(0)) {
      address masterFCM = masterFCMs[yieldBearingProtocolID];
      fcm = IFCM(address(new VoltzERC1967Proxy(masterFCM, "")));
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

