// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./Time.sol";

/// @title A utility library for mathematics of fixed and variable token amounts.
library FixedAndVariableMath {
    /// @notice Number of wei-seconds in a year
    /// @dev Ignoring leap years since we're only using it to calculate the eventual APY rate

    // suggestion: do this conversion with PRB.fromUnit()
    uint256 public constant SECONDS_IN_YEAR_IN_WAD = 31536000 * 10**18;
    uint256 public constant ONE_HUNDRED_IN_WAD = 100 * 10**18;

    /// @notice Caclulate the remaining cashflow to settle a position
    /// @param fixedTokenBalance The current balance of the fixed side of the position
    /// @param variableTokenBalance The current balance of the variable side of the position
    /// @param termStartTimestampWad When did the position begin, in seconds
    /// @param termEndTimestampWad When does the position reach maturity, in seconds
    /// @param variableFactorToMaturityWad What factor expresses the current remaining variable rate, up to position maturity? (in WAD)
    /// @return cashflow The remaining cashflow of the position
    function calculateSettlementCashflow(
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad,
        uint256 variableFactorToMaturityWad
    ) internal view returns (int256 cashflow) {
        /// @dev convert fixed and variable token balances to their respective fixed token representations

        int256 fixedTokenBalanceWad = PRBMathSD59x18.fromInt(fixedTokenBalance);
        int256 variableTokenBalanceWad = PRBMathSD59x18.fromInt(
            variableTokenBalance
        );

        int256 fixedCashflowWad = PRBMathSD59x18.mul(
            fixedTokenBalanceWad,
            int256(
                fixedFactor(true, termStartTimestampWad, termEndTimestampWad)
            )
        );

        int256 variableCashflowWad = PRBMathSD59x18.mul(
            variableTokenBalanceWad,
            int256(variableFactorToMaturityWad)
        );

        int256 cashflowWad = fixedCashflowWad + variableCashflowWad;

        /// @dev convert back to non-fixed point representation
        cashflow = PRBMathSD59x18.toInt(cashflowWad);
    }

    /// @notice Divide a given time in seconds by the number of seconds in a year
    /// @param timeInSecondsAsWad A time in seconds in Wad (i.e. scaled up by 10^18)
    /// @return timeInYearsWad An annualised factor of timeInSeconds, also in Wad
    function accrualFact(uint256 timeInSecondsAsWad)
        internal
        pure
        returns (uint256 timeInYearsWad)
    {
        timeInYearsWad = PRBMathUD60x18.div(
            timeInSecondsAsWad,
            SECONDS_IN_YEAR_IN_WAD
        );
    }

    /// @notice Calculate the fixed factor for a position - that is, the percentage earned over
    /// the specified period of time, assuming 1% per year
    /// @param atMaturity Whether to calculate the factor at maturity (true), or now (false)
    /// @param termStartTimestampWad When does the period of time begin, in wei-seconds
    /// @param termEndTimestampWad When does the period of time end, in wei-seconds
    /// @return fixedFactorValueWad The fixed factor for the position (in Wad)
    function fixedFactor(
        bool atMaturity,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad
    ) internal view returns (uint256 fixedFactorValueWad) {
        require(termEndTimestampWad > termStartTimestampWad, "E<=S");

        require(Time.blockTimestampScaled() >= termStartTimestampWad, "B.T<S");

        uint256 timeInSecondsWad;

        if (
            atMaturity || (Time.blockTimestampScaled() >= termEndTimestampWad)
        ) {
            timeInSecondsWad = termEndTimestampWad - termStartTimestampWad;
        } else {
            timeInSecondsWad =
                Time.blockTimestampScaled() -
                termStartTimestampWad;
        }

        uint256 timeInYearsWad = accrualFact(timeInSecondsWad);
        fixedFactorValueWad = PRBMathUD60x18.div(
            timeInYearsWad,
            ONE_HUNDRED_IN_WAD
        );
    }

    /// @notice Calculate the fixed token balance for a position over a timespan
    /// @param amount0Wad A fixed amount
    /// @param excessBalanceWad Any excess balance from the variable side of the position
    /// @param termStartTimestampWad When does the period of time begin, in wei-seconds
    /// @param termEndTimestampWad When does the period of time end, in wei-seconds
    /// @return fixedTokenBalanceWad The fixed token balance for that time period
    function calculateFixedTokenBalance(
        int256 amount0Wad,
        int256 excessBalanceWad,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad
    ) internal view returns (int256 fixedTokenBalanceWad) {
        require(termEndTimestampWad > termStartTimestampWad, "E<=S");

        /// explain the math in simple terms

        // expected fixed cashflow with unbalanced number of fixed tokens
        int256 exp1Wad = PRBMathSD59x18.mul(
            amount0Wad,
            int256(
                fixedFactor(true, termStartTimestampWad, termEndTimestampWad)
            )
        );

        // fixed cashflow with balanced number of fixed tokens, this cashflow accounts for the excess balance accrued since
        // the inception of the IRS AMM
        int256 numeratorWad = exp1Wad - excessBalanceWad;

        // fixed token balance that takes into account acrrued cashflows
        fixedTokenBalanceWad = PRBMathSD59x18.div(
            numeratorWad,
            int256(
                fixedFactor(true, termStartTimestampWad, termEndTimestampWad)
            )
        );
    }

    /// @notice Represent excess values accrued in some period
    struct AccruedValues {
        int256 excessFixedAccruedBalanceWad;
        int256 excessVariableAccruedBalanceWad;
        int256 excessBalanceWad;
    }

    /// @notice Calculate the excess balance of both sides of a position in Wad
    /// @param amount0Wad A fixed balance
    /// @param amount1Wad A variable balance
    /// @param accruedVariableFactorWad An annualised factor in wei-years
    /// @param termStartTimestampWad When does the period of time begin, in wei-seconds
    /// @param termEndTimestampWad When does the period of time end, in wei-seconds
    /// @return excessBalanceWad The excess balance in wad
    function getExcessBalance(
        int256 amount0Wad,
        int256 amount1Wad,
        uint256 accruedVariableFactorWad,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad
    ) internal view returns (int256) {
        AccruedValues memory accruedValues;

        accruedValues.excessFixedAccruedBalanceWad = PRBMathSD59x18.mul(
            amount0Wad,
            int256(
                fixedFactor(false, termStartTimestampWad, termEndTimestampWad)
            )
        );

        accruedValues.excessVariableAccruedBalanceWad = PRBMathSD59x18.mul(
            amount1Wad,
            int256(accruedVariableFactorWad)
        );

        /// @dev cashflows accrued since the inception of the IRS AMM

        accruedValues.excessBalanceWad =
            accruedValues.excessFixedAccruedBalanceWad +
            accruedValues.excessVariableAccruedBalanceWad;

        return accruedValues.excessBalanceWad;
    }

    /// @notice Calculate the fixed token balance given both fixed and variable balances
    /// @param amount0 A fixed balance
    /// @param amount1 A variable balance
    /// @param accruedVariableFactorWad An annualised factor in wei-years
    /// @param termStartTimestampWad When does the period of time begin, in wei-seconds
    /// @param termEndTimestampWad When does the period of time end, in wei-seconds
    /// @return fixedTokenBalance The fixed token balance for that time period
    function getFixedTokenBalance(
        int256 amount0,
        int256 amount1,
        uint256 accruedVariableFactorWad,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad
    ) internal view returns (int256 fixedTokenBalance) {
        if (amount0 == 0 && amount1 == 0) return 0;

        int256 amount0Wad = PRBMathSD59x18.fromInt(amount0);
        int256 amount1Wad = PRBMathSD59x18.fromInt(amount1);

        require(termEndTimestampWad > termStartTimestampWad, "E<=S");

        int256 excessBalanceWad = getExcessBalance(
            amount0Wad,
            amount1Wad,
            accruedVariableFactorWad,
            termStartTimestampWad,
            termEndTimestampWad
        );

        int256 fixedTokenBalanceWad = calculateFixedTokenBalance(
            amount0Wad,
            excessBalanceWad,
            termStartTimestampWad,
            termEndTimestampWad
        );

        fixedTokenBalance = PRBMathSD59x18.toInt(fixedTokenBalanceWad);
    }
}
