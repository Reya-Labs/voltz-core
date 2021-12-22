// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol"; 
import "../AMM.sol";


contract TestAMM is AMM {


  function testGetCurrentTickFromVAMM() external view returns(int24 currentTick) {
    (, int24 tick,) = vamm.slot0();
    return tick;
  }

}
