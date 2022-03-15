// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

import "contracts/utils/CustomErrors.sol";
import "./rate_oracles/IRateOracle.sol";
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
        address marginEngine,
        address vamm,
        address fcm,
        uint8 yieldBearingProtocolID
    );

    event MasterFCMSet(
        address masterFCMAddressOld,
        address masterFCMAddress,
        uint8 yieldBearingProtocolID
    );

    function setApproval(address intAddress, bool allowIntegration) external;

    function isApproved(address _owner, address intAddress)
        external
        view
        returns (bool);

    function setMasterFCM(address masterFCMAddress, address _rateOracle)
        external;

    function masterVAMM() external view returns (address);

    function masterMarginEngine() external view returns (address);

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
            address marginEngineProxy,
            address vammProxy,
            address fcmProxy
        );

    function masterFCMs(uint8 yieldBearingProtocolID)
        external
        returns (address masterFCMAddress);
}
