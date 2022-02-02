// SPDX-License-Identifier: MIT

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
        termEndTimestamp = IMarginEngine(marginEngineAddress)
            .termEndTimestampWad();
    }

    function testGetAMMTermEndTimestamp() external view returns (uint256) {
        return IMarginEngine(marginEngineAddress).termEndTimestampWad();
    }

    function setTestProtocolFees(uint256 _protocolFees) external {
        protocolFees = _protocolFees;
    }

    function getProtocolFees() external view returns (uint256) {
        return protocolFees;
    }

    function setVariableTokenGrowthGlobal(int256 _variableTokenGrowthGlobalX128)
        external
    {
        variableTokenGrowthGlobalX128 = _variableTokenGrowthGlobalX128;
    }

    function setFixedTokenGrowthGlobal(int256 _fixedTokenGrowthGlobalX128)
        external
    {
        fixedTokenGrowthGlobalX128 = _fixedTokenGrowthGlobalX128;
    }

    function setTickTest(int24 tick, Tick.Info memory info) external {
        ticks[tick] = info;
    }

    function getCurrentTick() external view returns (int24 currentTick) {
        return vammVars.tick;
    }

    function getGasLeft() external view returns (uint256 gas) {
        return gasleft();
    }
}
