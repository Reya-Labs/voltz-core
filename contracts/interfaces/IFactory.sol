// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.0;

/// @title The interface for the Voltz AMM Factory
/// @notice The AMM Factory facilitates creation of Voltz AMMs
interface IFactory {
    event IrsInstanceDeployed(
        address indexed underlyingToken,
        address indexed rateOracle,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad,
        address marginEngine,
        address vamm,
        address fcm
    );

    function setApproval(address intAddress, bool allowIntegration) external;

    function isApproved(address intAddress) external view returns (bool);

    function setMasterFCM(address masterFCMAddress, address _rateOracle)
        external;

    function getVAMMAddress(
        address _underlyingToken,
        address _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
    ) external view returns (address);

    function getMarginEngineAddress(
        address _underlyingToken,
        address _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
    ) external view returns (address);

    function getFCMAddress(
        address _underlyingToken,
        address _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
    ) external view returns (address);

    function masterVAMM() external view returns (address);

    function masterMarginEngine() external view returns (address);

    /// @notice Deploys the contracts required for a new Interest Rate Swap instance
    function deployIrsInstance(
        address _underlyingToken,
        address _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
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
