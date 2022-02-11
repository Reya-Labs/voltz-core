// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IFCM {

  function initiateFullyCollateralisedFixedTakerSwap(uint256 notional, uint160 sqrtPriceLimitX96) external;

  function unwindFullyCollateralisedFixedTakerSwap(uint256 notionalToUnwind, uint160 sqrtPriceLimitX96) external;

  function settleTrader() external;

  function transferMarginToMarginEngineTrader(address _account, uint256 marginDeltaInUnderlyingTokens) external;

}
