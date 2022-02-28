// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../aave/IAaveV2LendingPool.sol";
import "../IERC20Minimal.sol";

interface IAaveFCM { 
    
    function aaveLendingPool() external returns (IAaveV2LendingPool);

    function underlyingYieldBearingToken() external returns (IERC20Minimal); 
}