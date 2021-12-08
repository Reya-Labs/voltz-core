// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "./IAMM.sol";

interface IMarginEngine {

    // todo: duplicated from IVAMM.sol
    struct ModifyPositionParams {
        // the address that owns the position
        address owner;
        // the lower and upper tick of the position
        int24 tickLower;
        int24 tickUpper;
        // any change in liquidity
        int128 liquidityDelta;
    }
    
    function amm() external view returns (IAMM);

    function setAMM(address _ammAddress) external;

    function updatePositionMargin(ModifyPositionParams memory params, int256 marginDelta) external;

    function updateTraderMargin(address recipient, int256 marginDelta) external;

    function settlePosition(ModifyPositionParams memory params) external;

    function settleTrader(address recipient) external;

    function liquidatePosition(ModifyPositionParams memory params) external;

    function liquidateTrader(address traderAddress) external;
}