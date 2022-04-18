// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/IMarginEngine.sol";

// needs a reference to a given margin engine

contract TestLiquidatorBot {
    IMarginEngine public marginEngine;

    constructor(IMarginEngine _marginEngine) {
        require(address(_marginEngine) != address(0), "me must exist");
        marginEngine = _marginEngine;
    }

    // get liquidation incentive

    // check liquidation margin requirement

    // liquidate a position

    // function liquidatePosition() {

    // }
}
