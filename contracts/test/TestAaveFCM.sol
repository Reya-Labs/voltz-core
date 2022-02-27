// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../AaveFCM.sol";

contract TestAaveFCM is AaveFCM {
    function getVAMMAddress() external view returns (address) {
        return address(vamm);
    }

    function getUnderlyingYieldBearingToken() external view returns (address) {
        return address(underlyingYieldBearingToken);
    }

    function getAaveLendingPool() external view returns (address) {
        return address(aaveLendingPool);
    }
}
