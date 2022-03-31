// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../VAMM.sol";

contract TestVAMM is VAMM {
    function checkMaturityDuration()
        external
        view
        checkCurrentTimestampTermEndTimestampDelta
        returns (uint256 currentTimestamp, uint256 termEndTimestamp)
    {
        currentTimestamp = Time.blockTimestampScaled();
        termEndTimestamp = termEndTimestampWad;
    }

    function testGetAMMTermEndTimestamp() external view returns (uint256) {
        return termEndTimestampWad;
    }

    function setTestProtocolFees(uint256 newProtocolFees) external {
        _protocolFees = newProtocolFees;
    }

    function getProtocolFees() external view returns (uint256) {
        return _protocolFees;
    }

    function setVariableTokenGrowthGlobal(
        int256 newVariableTokenGrowthGlobalX128
    ) external {
        _variableTokenGrowthGlobalX128 = newVariableTokenGrowthGlobalX128;
    }

    function setFixedTokenGrowthGlobal(int256 newFixedTokenGrowthGlobalX128)
        external
    {
        _fixedTokenGrowthGlobalX128 = newFixedTokenGrowthGlobalX128;
    }

    function setTickTest(int24 tick, Tick.Info memory info) external {
        _ticks[tick] = info;
    }

    function getCurrentTick() external view returns (int24 currentTick) {
        return _vammVars.tick;
    }
}
