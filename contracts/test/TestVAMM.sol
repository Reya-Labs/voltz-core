pragma solidity ^0.8.0;

import "../VAMM.sol";

contract TestVAMM is VAMM {
    function checkMaturityDuration()
        external
        view
        checkCurrentTimestampTermEndTimestampDelta
        returns (uint256 currentTimestamp, uint256 termEndTimestamp)
    {
        currentTimestamp = Time.blockTimestampScaled();
        termEndTimestamp = amm.termEndTimestamp();
    }

    function testGetAMMTermEndTimestamp() external view returns (uint256) {
        return amm.termEndTimestamp();
    }

    function getAMMAddress() external view returns (address) {
        return address(amm);
    }

    function setTestProtocolFees(uint256 _protocolFees) external {
        protocolFees = _protocolFees;
    }

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
