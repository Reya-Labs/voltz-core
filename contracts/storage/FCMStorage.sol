// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/IERC20Minimal.sol";
import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../core_libraries/TraderWithYieldBearingAssets.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";

contract FCMStorageV1 {
    // Any variables that would implicitly implement an IMarginEngine function if public, must instead
    // be internal due to limitations in the solidity compiler (as of 0.8.12)
    IRateOracle internal _rateOracle;
    IMarginEngine internal _marginEngine;
    int24 internal tickSpacing;
    IVAMM internal _vamm;
    mapping(address => TraderWithYieldBearingAssets.Info) public traders;
    IERC20Minimal public underlyingToken;
}

contract AaveFCMStorageV1 {
    // Any variables that would implicitly implement an IMarginEngine function if public, must instead
    // be internal due to limitations in the solidity compiler (as of 0.8.12)
    IAaveV2LendingPool internal _aaveLendingPool;
    IERC20Minimal internal _underlyingYieldBearingToken;
}

contract FCMStorage is FCMStorageV1 {
    // Reserve some storage for use in future versions, without creating conflicts
    // with other inheritted contracts
    uint256[44] private __gap;
}

contract AaveFCMStorage is FCMStorage, AaveFCMStorageV1 {
    // Reserve some storage for use in future versions, without creating conflicts
    // with other inheritted contracts
    uint256[48] private __gap;
}
