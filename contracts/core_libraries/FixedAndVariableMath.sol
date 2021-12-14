// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "prb-math/contracts/PRBMathSD59x18Typed.sol";
import "prb-math/contracts/PRBMathUD60x18Typed.sol";
import "./Time.sol";
import "hardhat/console.sol";

/// @title A utility library for mathematics of fixed and variable token amounts.
/// @author Artur Begyan
library FixedAndVariableMath {
  /// @notice Number of wei-seconds in a year
  /// @dev Ignoring leap years since we're only using it to calculate the eventual APY rate
  uint256 public constant SECONDS_IN_YEAR = 31536000 * 10**18;
  
  // no longer need this
  // /// @notice One percent
  // /// @dev No scary unnamed constants!
  // uint256 internal constant ONE_PERCENT = 10**16;

  /// @notice Caclulate the remaining cashflow to settle a position
  /// @param fixedTokenBalance The current balance of the fixed side of the position
  /// @param variableTokenBalance The current balance of the variable side of the position
  /// @param termStartTimestamp When did the position begin, in seconds
  /// @param termEndTimestamp When does the position reach maturity, in seconds
  /// @param variableFactorToMaturity What factor expresses the current remaining variable rate, up to position maturity?
  /// @return cashflow The remaining cashflow of the position
  function calculateSettlementCashflow(
    int256 fixedTokenBalance,
    int256 variableTokenBalance,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp,
    uint256 variableFactorToMaturity
  ) external view returns (int256 cashflow) {
    PRBMath.SD59x18 memory fixedCashflow = PRBMathSD59x18Typed.mul(
      PRBMath.SD59x18({ value: fixedTokenBalance }),
      PRBMath.SD59x18({
        value: int256(fixedFactor(true, termStartTimestamp, termEndTimestamp))
      })
    );

    PRBMath.SD59x18 memory variableCashflow = PRBMathSD59x18Typed.mul(
      PRBMath.SD59x18({ value: variableTokenBalance }),
      PRBMath.SD59x18({ value: int256(variableFactorToMaturity) })
    );

    cashflow = PRBMathSD59x18Typed.add(fixedCashflow, variableCashflow).value;
  }

  /// @notice Divide a given time in seconds by the number of wei-seconds in a year
  /// @param timeInSeconds A time in wei-seconds
  /// @return timeInYears An annualised factor of timeInSeconds
  ///
  /// #if_succeeds $result > 0;
  /// #if_succeeds old(timeInSeconds) > 0;
  function accrualFact(uint256 timeInSeconds)
    public
    view
    returns (uint256 timeInYears)
  {
    timeInYears = PRBMathUD60x18Typed
      .div(
        PRBMath.UD60x18({ value: timeInSeconds }),
        PRBMath.UD60x18({ value: SECONDS_IN_YEAR })
      )
      .value;
    
    console.log("Contract: Time in Years is ", timeInYears);

  }

  /// @notice Calculate the fixed factor for a position
  /// @param atMaturity Whether to calculate the factor at maturity (true), or now (false)
  /// @param termStartTimestamp When does the period of time begin, in wei-seconds
  /// @param termEndTimestamp When does the period of time end, in wei-seconds
  /// @return fixedFactorValue The fixed factor for the position
  /// 
  /// #if_succeeds old(termStartTimestamp) < old(termEndTimestamp);
  /// #if_succeeds old(atMaturity) == true ==> timeInSeconds == termEndTimestamp - termStartTimestamp;
  function fixedFactor(
    bool atMaturity,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) public view returns (uint256 fixedFactorValue) {
    require(
        termEndTimestamp > termStartTimestamp,
        "E<=S"
    );

    require(
        Time.blockTimestampScaled() >= termStartTimestamp,
        "B.T>=S"
    );

    require(
        Time.blockTimestampScaled() <= termEndTimestamp,
        "B.T>=S"
    );

    uint256 timeInSeconds;

    if (atMaturity) {
      timeInSeconds = PRBMathUD60x18Typed
        .sub(
          PRBMath.UD60x18({ value: termEndTimestamp }),
          PRBMath.UD60x18({ value: termStartTimestamp })
        )
        .value;
    } else {
      timeInSeconds = Time.blockTimestampScaled() - termStartTimestamp;
    }

    uint256 timeInYears = accrualFact(timeInSeconds);

    // fixedFactorValue = PRBMathUD60x18Typed
    //   .mul(
    //     PRBMath.UD60x18({ value: timeInYears }),
    //     PRBMath.UD60x18({ value: ONE_PERCENT })
    //   )
    //   .value;
    // interesting the change below fixes the margin calculator tests

    fixedFactorValue = PRBMathUD60x18Typed
      .div(
        PRBMath.UD60x18({ value: timeInYears }),
        PRBMath.UD60x18({ value: 100 * (10**18) })
      )
      .value;
    
    console.log("Contract: Fixed factor value is ", fixedFactorValue);
    
  }

  /// @notice Calculate the fixed token balance for a position over a timespan
  /// @param amount0 A fixed amount
  /// @param excessBalance Any excess balance from the variable side of the position
  /// @param termStartTimestamp When does the period of time begin, in wei-seconds
  /// @param termEndTimestamp When does the period of time end, in wei-seconds
  /// @return fixedTokenBalance The fixed token balance for that time period
  ///  
  /// #if_succeeds old(termStartTimestamp) < old(termEndTimestamp);
  /// #if_succeeds excessBalance < 0 ==> fixedTokenBalance > amount0;
  /// #if_succeeds excessBalance > 0 ==> fixedTokenBalance < amount0;
  function calculateFixedTokenBalance(
    int256 amount0,
    int256 excessBalance,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) internal view returns (int256 fixedTokenBalance) {
    require(termEndTimestamp > termStartTimestamp, "E<=S");

    // expected fixed cashflow with unbalanced number of fixed tokens
    PRBMath.SD59x18 memory exp1 = PRBMathSD59x18Typed.mul(
      PRBMath.SD59x18({ value: amount0 }),
      PRBMath.SD59x18({
        value: int256(fixedFactor(true, termStartTimestamp, termEndTimestamp))
      })
    );

    // fixed cashflow  with balanced number of fixed tokens
    PRBMath.SD59x18 memory numerator = PRBMathSD59x18Typed.sub(
      exp1,
      PRBMath.SD59x18({ value: excessBalance })
    );

    // fixed token balance that takes into account acrrued cashflows
    fixedTokenBalance = PRBMathSD59x18Typed
      .div(
        numerator,
        PRBMath.SD59x18({
          value: int256(fixedFactor(true, termStartTimestamp, termEndTimestamp))
        })
      )
      .value;
  }

  /// @notice Represent excess values accrued in some period
  struct AccruedValues {
    int256 excessFixedAccruedBalance;
    int256 excessVariableAccruedBalance;
    int256 excessBalance;
  }

  /// @notice Calculate the excess balance of both sides of a position
  /// @param amount0 A fixed balance
  /// @param amount1 A variable balance
  /// @param accruedVariableFactor An annualised factor in wei-years
  /// @param termStartTimestamp When does the period of time begin, in wei-seconds
  /// @param termEndTimestamp When does the period of time end, in wei-seconds
  /// @return excessBalance The excess balance
  function getExcessBalance(
    int256 amount0,
    int256 amount1,
    uint256 accruedVariableFactor,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) internal view returns (int256) {
    AccruedValues memory accruedValues;

    accruedValues.excessFixedAccruedBalance = PRBMathSD59x18Typed
      .mul(
        PRBMath.SD59x18({ value: amount0 }),
        PRBMath.SD59x18({
          value: int256(
            fixedFactor(false, termStartTimestamp, termEndTimestamp)
          )
        })
      )
      .value;

    accruedValues.excessVariableAccruedBalance = PRBMathSD59x18Typed
      .mul(
        PRBMath.SD59x18({ value: amount1 }),
        PRBMath.SD59x18({ value: int256(accruedVariableFactor) })
      )
      .value;

    accruedValues.excessBalance = PRBMathSD59x18Typed
      .add(
        PRBMath.SD59x18({ value: accruedValues.excessFixedAccruedBalance }),
        PRBMath.SD59x18({ value: accruedValues.excessVariableAccruedBalance })
      )
      .value;

    return accruedValues.excessBalance;
  }

  /// @notice Calculate the fixed token balance given both fixed and variable balances
  /// @param amount0 A fixed balance
  /// @param amount1 A variable balance
  /// @param accruedVariableFactor An annualised factor in wei-years
  /// @param termStartTimestamp When does the period of time begin, in wei-seconds
  /// @param termEndTimestamp When does the period of time end, in wei-seconds
  /// @return fixedTokenBalance The fixed token balance for that time period
  ///
  /// #if_succeeds termEndTimestamp > termStartTimestamp;
  function getFixedTokenBalance(
    int256 amount0,
    int256 amount1,
    uint256 accruedVariableFactor,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  ) public view returns (int256 fixedTokenBalance) {
    require(
      amount0 ^ amount1 < 0,
      "amount0 and amount1 must have different signs"
    );

    require(
        termEndTimestamp > termStartTimestamp,
        "E<=S"
    );

    int256 excessBalance = getExcessBalance(
      amount0,
      amount1,
      accruedVariableFactor,
      termStartTimestamp,
      termEndTimestamp
    );

    fixedTokenBalance = calculateFixedTokenBalance(
      amount0,
      excessBalance,
      termStartTimestamp,
      termEndTimestamp
    );
  }
}
