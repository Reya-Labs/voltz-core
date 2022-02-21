// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IMarginEngine.sol";

interface IFCM {
    
    function initiateFullyCollateralisedFixedTakerSwap(
        uint256 notional,
        uint160 sqrtPriceLimitX96
    ) external;

    function unwindFullyCollateralisedFixedTakerSwap(
        uint256 notionalToUnwind,
        uint160 sqrtPriceLimitX96
    ) external;

    function settleTrader() external;
    
    /// @notice
    /// @param _account address of the position owner from the Margin
    function transferMarginToMarginEngineTrader(
        address _account,
        uint256 marginDeltaInUnderlyingTokens
    ) external;

    /// @notice initialize is the constructor for the proxy instances of the FCM
    /// @dev "constructor" for proxy instances
    /// @dev in the initialize function we set the vamm and the margiEngine associated with the fcm
    /// @dev different FCM implementations are free to have different implementations for the initialisation logic
    function initialize(address _vammAddress, address _marginEngineAddress)
        external;

    /// @notice Margine Engine linked to the Full Collateralisation Module
    /// @return marginEngine Margine Engine linked to the Full Collateralisation Module
    function marginEngine() external view returns (IMarginEngine);
}
