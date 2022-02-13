// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

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

    function transferMarginToMarginEngineTrader(
        address _account,
        uint256 marginDeltaInUnderlyingTokens
    ) external;

    function traders(address key)
        external
        view
        returns (
            uint256 marginInScaledYieldBearingTokens,
            int256 fixedTokenBalance,
            int256 variableTokenBalance,
            bool isSettled,
            uint256 lastMarginUpdateBlockTimestmap,
            uint256 rateFromRayLastUpdate
        );
    
    /// @dev "constructor" for proxy instances
    function initialize(address _vammAddress, address _marginEngineAddress) external;
}
