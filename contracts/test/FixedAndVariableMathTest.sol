// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../core_libraries/FixedAndVariableMath.sol";

contract FixedAndVariableMathTest {
    function calculateSettlementCashflow(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp,
        uint256 variableFactorToMaturity
    ) external view returns (int256 cashflow) {
        return
            FixedAndVariableMath.calculateSettlementCashflow(
                fixedTokenBalance,
                variableTokenBalance,
                termStartTimestamp,
                termEndTimestamp,
                variableFactorToMaturity
            );
    }

    function accrualFact(uint256 timeInSeconds)
        public
        pure
        returns (uint256 timeInYears)
    {
        return FixedAndVariableMath.accrualFact(timeInSeconds);
    }

    function fixedFactorTest(
        bool atMaturity,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (uint256 fixedFactorValue) {
        return
            FixedAndVariableMath.fixedFactor(
                atMaturity,
                termStartTimestamp,
                termEndTimestamp
            );
    }

    function calculateFixedTokenBalance(
        int256 amount0,
        int256 excessBalance,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (int256 fixedTokenBalance) {
        return
            FixedAndVariableMath.calculateFixedTokenBalance(
                amount0,
                excessBalance,
                termStartTimestamp,
                termEndTimestamp
            );
    }

    function getExcessBalance(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) public view returns (int256) {
        return
            FixedAndVariableMath.getExcessBalance(
                amount0,
                amount1,
                accruedVariableFactor,
                termStartTimestamp,
                termEndTimestamp
            );
    }

    function getFixedTokenBalance(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactor,
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    ) external view returns (int256 fixedTokenBalance) {
        return
            FixedAndVariableMath.getFixedTokenBalance(
                amount0,
                amount1,
                accruedVariableFactor,
                termStartTimestamp,
                termEndTimestamp
            );
    }
}
