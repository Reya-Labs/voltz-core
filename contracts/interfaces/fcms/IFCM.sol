// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../IMarginEngine.sol";
import "../IVAMM.sol";
import "../IERC20Minimal.sol";

interface IFCM {
    /// @notice Initiate a Fully Collateralised Fixed Taker Swap
    /// @param notional amount of notional (in terms of the underlying token) to trade
    /// @param sqrtPriceLimitX96 the sqrtPriceLimit (in binary fixed point math notation) beyond which swaps won't be executed
    /// @dev An example of an initiated fully collateralised fixed taker swap is a scenario where a trader with 100aTokens wishes to get a fixed return on them
    /// @dev they can choose to deposit their 100aTokens into the FCM (enter into a fixed taker position with a notional of 100) to swap variable vashflows from the aTokens
    /// @dev with the fixed cashflows from the variable takers
    function initiateFullyCollateralisedFixedTakerSwap(
        uint256 notional,
        uint160 sqrtPriceLimitX96
    ) external;

    /// @notice Unwind a Fully Collateralised Fixed Taker Swap
    /// @param notionalToUnwind The amount of notional of the original Fully Collateralised Fixed Taker swap to be unwound at the current VAMM fixed rates
    /// @param sqrtPriceLimitX96 the sqrtPriceLimit (in binary fixed point math notation) beyond which the unwind swaps won't be executed
    /// @dev The purpose of this function is to let fully collateralised fixed takers to exist their swaps by entering into variable taker positions against the VAMM
    /// @dev thus effectively releasing the margin in yield bearing tokens from the fixed swap contract
    function unwindFullyCollateralisedFixedTakerSwap(
        uint256 notionalToUnwind,
        uint160 sqrtPriceLimitX96
    ) external;

    /// @notice Settle Trader
    /// @dev this function in the fcm let's traders settle with the MarginEngine based on their settlement cashflows which is a functon of their fixed and variable token balances
    function settleTrader() external;

    /// @notice
    /// @param _account address of the position owner from the MarginEngine who wishes to settle with the FCM in underlying tokens
    /// @param marginDeltaInUnderlyingTokens amount in terms of underlying tokens that needs to be settled with the trader from the MarginEngine
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
    
    /// @notice VAMM linked to the Full Collateralisation Module
    /// @return VAMM linked to the Full Collateralisation Module
    function vamm() external view returns (IVAMM);

    /// @notice Rate Oracle linked to the Full Collateralisation Module
    /// @return Rate Oracle linked to the Full Collateralisation Module
    function rateOracle() external view returns (IRateOracle);

    function underlyingToken() external view returns (IERC20Minimal);
}
