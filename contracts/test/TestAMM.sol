// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../AMM.sol";

contract TestAMM is AMM {
    function testGetCurrentTickFromVAMM()
        external
        view
        returns (int24 currentTick)
    {
        (, int24 tick, ) = vamm.vammVars();
        return tick;
    }

    /// @dev vamm.updateProtocolFees can be called exclusively from the attached AMM
    /// @dev and, for testing purposes, we use this function just to redirect the call from the AMM
    function redirectVAMMUpdateProtocolFees(uint256 amount) external {
        vamm.updateProtocolFees(amount);
    }
}
