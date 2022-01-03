// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../core_libraries/Trader.sol";

contract TraderTest {
    Trader.Info public trader;
    using Trader for Trader.Info;


    function updateMargin(int256 marginDelta) public {
        trader.updateMargin(marginDelta);
    }

    function updateBalances(
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) public {
        trader.updateBalances(
            fixedTokenBalanceDelta,
            variableTokenBalanceDelta
        );
    }

}
