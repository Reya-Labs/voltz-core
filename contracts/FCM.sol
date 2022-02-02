// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IFCM.sol";
import "./core_libraries/Trader.sol";

// do we need a different trader library for fully collateralised traders?
// modifiers to disallow depositing of margin close to maturity
// add overrides
// base FCM --> spawn Aave, Compound fcms from there
// settle trader function
// change the name of the unwind boolean since now it handles both fcm and unwinds

// /// @dev Address of the trader initiating the swap
// address recipient;
// /// @dev is a given swap initiated by a fixed taker vs. a variable taker
// bool isFT;
// /// @dev The amount of the swap, which implicitly configures the swap as exact input (positive), or exact output (negative)
// int256 amountSpecified;
// /// @dev The Q64.96 sqrt price limit. If !isFT, the price cannot be less than this
// uint160 sqrtPriceLimitX96;
// /// @dev Is the swap triggered following a liquidation event resulting in an unwind
// bool isUnwind;
// /// @dev Is the swap triggered by a trader. If this is false then this is only possible in a scenario where a liquidity provider's position is liquidated
// /// @dev leading to an unwind of a liquidity provider
// bool isTrader;
// /// @dev in case the swap is triggered by a Liquidity Provider these values need to be present in Swap Params

// /// @dev lower tick of the liquidity provider (needs to be set if isTrader is false)
// int24 tickLower;
// /// @dev upper tick of the liqudiity provider (needs to be set if isTrader is false)
// int24 tickUpper;

contract AaveFCM is IFCM {

  using Trader for Trader.Info;
  
  address public underlyingYieldBearingToken;
  
  mapping(address => Trader.Info) public traders;
  

  function initiateFullyCollateralisedFixedTakerSwap(uint256 notional) external {
    
    

  }


  

}