// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../IMarginEngine.sol";
import "../IVAMM.sol";

interface IAMMActions {
    function setVAMM(address _vAMMAddress) external;
    function setMarginEngine(address _marginEngine) external;
    function setUnlocked(bool _unlocked) external;
    // TypeError: Function overload clash during conversion to external types for arguments.
    function updatePositionMargin(IVAMM.ModifyPositionParams memory params, int256 marginDelta) external;
    function updateTraderMargin(address recipient, int256 marginDelta) external;
    function settlePosition(IVAMM.ModifyPositionParams memory params) external;
    function settleTrader(address recipient) external;
    function liquidatePosition(IVAMM.ModifyPositionParams memory params) external;
    function liquidateTrader(address traderAddress) external;
    function burn(int24 tickLower, int24 tickUpper, uint128 amount) external;
    function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount) external;
    function swap(IVAMM.SwapParams memory params) external;
    // function setFeeProtocol(uint256 feeProtocol) external;
    // function collectProtocol(address recipient, uint256 amountRequested) external;
}
