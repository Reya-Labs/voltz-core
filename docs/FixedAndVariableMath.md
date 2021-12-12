# FixedAndVariableMath

_Artur Begyan_

> A utility library for mathematics of fixed and variable token amounts.

## Methods

### SECONDS_IN_YEAR

```solidity
function SECONDS_IN_YEAR() external view returns (uint256)
```

Number of wei-seconds in a year

_Ignoring leap years since we&#39;re only using it to calculate the eventual APY rate_

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### accrualFact

```solidity
function accrualFact(uint256 timeInSeconds) external pure returns (uint256 timeInYears)
```

Divide a given time in seconds by the number of wei-seconds in a year

#### Parameters

| Name          | Type    | Description           |
| ------------- | ------- | --------------------- |
| timeInSeconds | uint256 | A time in wei-seconds |

#### Returns

| Name        | Type    | Description                                                                                                |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| timeInYears | uint256 | An annualised factor of timeInSeconds #if_succeeds $result &gt; 0; #if_succeeds old(timeInSeconds) &gt; 0; |

### calculateSettlementCashflow

```solidity
function calculateSettlementCashflow(int256 fixedTokenBalance, int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, uint256 variableFactorToMaturity) external view returns (int256 cashflow)
```

Caclulate the remaining cashflow to settle a position

#### Parameters

| Name                     | Type    | Description                                                                         |
| ------------------------ | ------- | ----------------------------------------------------------------------------------- |
| fixedTokenBalance        | int256  | The current balance of the fixed side of the position                               |
| variableTokenBalance     | int256  | The current balance of the variable side of the position                            |
| termStartTimestamp       | uint256 | When did the position begin, in seconds                                             |
| termEndTimestamp         | uint256 | When does the position reach maturity, in seconds                                   |
| variableFactorToMaturity | uint256 | What factor expresses the current remaining variable rate, up to position maturity? |

#### Returns

| Name     | Type   | Description                            |
| -------- | ------ | -------------------------------------- |
| cashflow | int256 | The remaining cashflow of the position |

### fixedFactor

```solidity
function fixedFactor(bool atMaturity, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (uint256 fixedFactorValue)
```

Calculate the fixed factor for a position

#### Parameters

| Name               | Type    | Description                                                        |
| ------------------ | ------- | ------------------------------------------------------------------ |
| atMaturity         | bool    | Whether to calculate the factor at maturity (true), or now (false) |
| termStartTimestamp | uint256 | When does the period of time begin, in wei-seconds                 |
| termEndTimestamp   | uint256 | When does the period of time end, in wei-seconds                   |

#### Returns

| Name             | Type    | Description                                                                                                                                                                                            |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| fixedFactorValue | uint256 | The fixed factor for the position #if_succeeds old(termStartTimestamp) &lt; old(termEndTimestamp); #if_succeeds old(atMaturity) == true ==&gt; timeInSeconds == termEndTimestamp - termStartTimestamp; |

### getFixedTokenBalance

```solidity
function getFixedTokenBalance(int256 amount0, int256 amount1, uint256 accruedVariableFactor, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (int256 fixedTokenBalance)
```

Calculate the fixed token balance given both fixed and variable balances

#### Parameters

| Name                  | Type    | Description                                        |
| --------------------- | ------- | -------------------------------------------------- |
| amount0               | int256  | A fixed balance                                    |
| amount1               | int256  | A variable balance                                 |
| accruedVariableFactor | uint256 | An annualised factor in wei-years                  |
| termStartTimestamp    | uint256 | When does the period of time begin, in wei-seconds |
| termEndTimestamp      | uint256 | When does the period of time end, in wei-seconds   |

#### Returns

| Name              | Type   | Description                                                                                         |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------- |
| fixedTokenBalance | int256 | The fixed token balance for that time period #if_succeeds termEndTimestamp &gt; termStartTimestamp; |

## Errors

### PRBMathSD59x18\_\_DivInputTooSmall

```solidity
error PRBMathSD59x18__DivInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.

### PRBMathSD59x18\_\_DivOverflow

```solidity
error PRBMathSD59x18__DivOverflow(uint256 rAbs)
```

Emitted when one of the intermediary unsigned results overflows SD59x18.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| rAbs | uint256 | undefined   |

### PRBMathSD59x18\_\_MulInputTooSmall

```solidity
error PRBMathSD59x18__MulInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.

### PRBMathSD59x18\_\_MulOverflow

```solidity
error PRBMathSD59x18__MulOverflow(uint256 rAbs)
```

Emitted when the intermediary absolute result overflows SD59x18.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| rAbs | uint256 | undefined   |

### PRBMathUD60x18\_\_SubUnderflow

```solidity
error PRBMathUD60x18__SubUnderflow(uint256 x, uint256 y)
```

Emitted when subtraction underflows UD60x18.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| x    | uint256 | undefined   |
| y    | uint256 | undefined   |

### PRBMath\_\_MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.

#### Parameters

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| prod1 | uint256 | undefined   |

### PRBMath\_\_MulDivOverflow

```solidity
error PRBMath__MulDivOverflow(uint256 prod1, uint256 denominator)
```

Emitted when the result overflows uint256.

#### Parameters

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| prod1       | uint256 | undefined   |
| denominator | uint256 | undefined   |
