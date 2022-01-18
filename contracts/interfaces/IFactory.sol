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
        address marginEngin,
        address vamm
    );

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

    function masterVAMM() external view returns (address);

    function masterMarginEngine() external view returns (address);

    /// @notice Deploys the contracts required for a new Interest Rate Swap instance
    function deployIrsInstance(
        address _underlyingToken,
        address _rateOracle,
        uint256 _termStartTimestampWad,
        uint256 _termEndTimestampWad
    ) external returns (address marginEngineProxy, address vammProxy);
}
