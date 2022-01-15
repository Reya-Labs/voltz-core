// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/LiquidityMath.sol";

contract LiquidityMathTest {
    function addDelta(uint128 x, int128 y) external pure returns (uint128 z) {
        return LiquidityMath.addDelta(x, y);
    }

    function getGasCostOfAddDelta(uint128 x, int128 y)
        external
        view
        returns (uint256)
    {
        uint256 gasBefore = gasleft();
        LiquidityMath.addDelta(x, y);
        return gasBefore - gasleft();
    }
}
