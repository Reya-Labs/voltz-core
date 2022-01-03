pragma solidity ^0.8.0;

import "../VAMM.sol";

contract TestVAMM is VAMM {
    function setVariableTokenGrowthGlobal(int256 _variableTokenGrowthGlobal)
        external
    {
        variableTokenGrowthGlobal = _variableTokenGrowthGlobal;
    }

    function setFixedTokenGrowthGlobal(int256 _fixedTokenGrowthGlobal)
        external
    {
        fixedTokenGrowthGlobal = _fixedTokenGrowthGlobal;
    }

    function setTickTest(int24 tick, Tick.Info memory info) external {
        ticks[tick] = info;
    }


}
