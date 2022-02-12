// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../AaveFCM.sol";

contract TestAaveFCM is AaveFCM {
    constructor(
        address _underlyingYieldBearingToken,
        address _vammAddress,
        address _marginEngineAddress,
        address _aaveLendingPool
    )
        AaveFCM(
            _underlyingYieldBearingToken,
            _vammAddress,
            _marginEngineAddress,
            _aaveLendingPool
        )
    {}
}
