// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

import "contracts/utils/CustomErrors.sol";
import "./rate_oracles/IRateOracle.sol";
import "./IMarginEngine.sol";
import "./IVAMM.sol";
import "./fcms/IFCM.sol";
import "./IERC20Minimal.sol";

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs
interface IFactory is CustomErrors {
    event IrsInstanceDeployed(
        IERC20Minimal indexed underlyingToken,
        IRateOracle indexed rateOracle,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad,
        int24 tickSpacing,
        IMarginEngine marginEngine,
        IVAMM vamm,
        IFCM fcm,
        uint8 yieldBearingProtocolID
    );

    event MasterFCMSet(
        IFCM masterFCMAddressOld,
        IFCM masterFCMAddress,
        uint8 yieldBearingProtocolID
    );

    event ApprovalSet(
        address indexed owner,
        address indexed intAddress,
        bool indexed isApproved
    );

    function setApproval(address intAddress, bool allowIntegration) external;

    function isApproved(address _owner, address intAddress)
        external
        view
        returns (bool);

    function setMasterFCM(IFCM masterFCM, uint8 yieldBearingProtocolID)
        external;

    function masterVAMM() external view returns (IVAMM);

    function masterMarginEngine() external view returns (IMarginEngine);

    /// @notice Deploys the contracts required for a new Interest Rate Swap instance
    function deployIrsInstance(
        IERC20Minimal _underlyingToken,
        IRateOracle _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad,
        int24 _tickSpacing
    )
        external
        returns (
            IMarginEngine marginEngineProxy,
            IVAMM vammProxy,
            IFCM fcmProxy
        );

    function masterFCMs(uint8 yieldBearingProtocolID)
        external
        returns (IFCM masterFCM);
}
