# MarginCalculatorTest

## Methods

### SECONDS_IN_YEAR

```solidity
function SECONDS_IN_YEAR() external view returns (uint256)
```

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### getAlpha

```solidity
function getAlpha(bytes32) external view returns (int256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| value | int256 | undefined   |

### getApyLowerMultiplier

```solidity
function getApyLowerMultiplier(bytes32) external view returns (uint256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| value | uint256 | undefined   |

### getApyUpperMultiplier

```solidity
function getApyUpperMultiplier(bytes32) external view returns (uint256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| value | uint256 | undefined   |

### getBeta

```solidity
function getBeta(bytes32) external view returns (int256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| value | int256 | undefined   |

### getMaxLeverage

```solidity
function getMaxLeverage(bytes32) external view returns (uint256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| value | uint256 | undefined   |

### getMinDeltaLM

```solidity
function getMinDeltaLM(bytes32) external view returns (uint256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| value | uint256 | undefined   |

### getMinDeltaMM

```solidity
function getMinDeltaMM(bytes32) external view returns (uint256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| value | uint256 | undefined   |

### getMinimumMarginRequirement

```solidity
function getMinimumMarginRequirement(IMarginCalculator.TraderMarginRequirementParams params) external view returns (uint256 margin)
```

#### Parameters

| Name   | Type                                            | Description |
| ------ | ----------------------------------------------- | ----------- |
| params | IMarginCalculator.TraderMarginRequirementParams | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| margin | uint256 | undefined   |

### getMinimumMarginRequirementTest

```solidity
function getMinimumMarginRequirementTest(int256 fixedTokenBalance, int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, bool isLM) external view returns (uint256 margin)
```

#### Parameters

| Name                 | Type    | Description |
| -------------------- | ------- | ----------- |
| fixedTokenBalance    | int256  | undefined   |
| variableTokenBalance | int256  | undefined   |
| termStartTimestamp   | uint256 | undefined   |
| termEndTimestamp     | uint256 | undefined   |
| isLM                 | bool    | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| margin | uint256 | undefined   |

### getPositionMarginRequirement

```solidity
function getPositionMarginRequirement(IMarginCalculator.PositionMarginRequirementParams params) external view returns (uint256 margin)
```

#### Parameters

| Name   | Type                                              | Description |
| ------ | ------------------------------------------------- | ----------- |
| params | IMarginCalculator.PositionMarginRequirementParams | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| margin | uint256 | undefined   |

### getSigmaSquared

```solidity
function getSigmaSquared(bytes32) external view returns (int256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| value | int256 | undefined   |

### getTraderMarginRequirement

```solidity
function getTraderMarginRequirement(IMarginCalculator.TraderMarginRequirementParams params) external view returns (uint256 margin)
```

#### Parameters

| Name   | Type                                            | Description |
| ------ | ----------------------------------------------- | ----------- |
| params | IMarginCalculator.TraderMarginRequirementParams | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| margin | uint256 | undefined   |

### getTraderMarginRequirementTest

```solidity
function getTraderMarginRequirementTest(int256 fixedTokenBalance, int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, bool isLM) external view returns (uint256 margin)
```

#### Parameters

| Name                 | Type    | Description |
| -------------------- | ------- | ----------- |
| fixedTokenBalance    | int256  | undefined   |
| variableTokenBalance | int256  | undefined   |
| termStartTimestamp   | uint256 | undefined   |
| termEndTimestamp     | uint256 | undefined   |
| isLM                 | bool    | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| margin | uint256 | undefined   |

### getXiLower

```solidity
function getXiLower(bytes32) external view returns (int256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| value | int256 | undefined   |

### getXiUpper

```solidity
function getXiUpper(bytes32) external view returns (int256 value)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | bytes32 | undefined   |

#### Returns

| Name  | Type   | Description |
| ----- | ------ | ----------- |
| value | int256 | undefined   |

### isLiquidatablePosition

```solidity
function isLiquidatablePosition(IMarginCalculator.PositionMarginRequirementParams params, int256 currentMargin) external view returns (bool _isLiquidatable)
```

#### Parameters

| Name          | Type                                              | Description |
| ------------- | ------------------------------------------------- | ----------- |
| params        | IMarginCalculator.PositionMarginRequirementParams | undefined   |
| currentMargin | int256                                            | undefined   |

#### Returns

| Name             | Type | Description |
| ---------------- | ---- | ----------- |
| \_isLiquidatable | bool | undefined   |

### isLiquidatableTrader

```solidity
function isLiquidatableTrader(IMarginCalculator.TraderMarginRequirementParams params, int256 currentMargin) external view returns (bool isLiquidatable)
```

#### Parameters

| Name          | Type                                            | Description |
| ------------- | ----------------------------------------------- | ----------- |
| params        | IMarginCalculator.TraderMarginRequirementParams | undefined   |
| currentMargin | int256                                          | undefined   |

#### Returns

| Name           | Type | Description |
| -------------- | ---- | ----------- |
| isLiquidatable | bool | undefined   |

### worstCaseVariableFactorAtMaturityTest

```solidity
function worstCaseVariableFactorAtMaturityTest(uint256 timeInSeconds, bool isFT, bool isLM, bytes32 rateOracleId, uint256 twapApy) external view returns (uint256 variableFactor)
```

#### Parameters

| Name          | Type    | Description |
| ------------- | ------- | ----------- |
| timeInSeconds | uint256 | undefined   |
| isFT          | bool    | undefined   |
| isLM          | bool    | undefined   |
| rateOracleId  | bytes32 | undefined   |
| twapApy       | uint256 | undefined   |

#### Returns

| Name           | Type    | Description |
| -------------- | ------- | ----------- |
| variableFactor | uint256 | undefined   |

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

### PRBMathSD59x18\_\_SqrtNegativeInput

```solidity
error PRBMathSD59x18__SqrtNegativeInput(int256 x)
```

Emitted when the input is negative.

#### Parameters

| Name | Type   | Description |
| ---- | ------ | ----------- |
| x    | int256 | undefined   |

### PRBMathSD59x18\_\_SqrtOverflow

```solidity
error PRBMathSD59x18__SqrtOverflow(int256 x)
```

Emitted when the calculating the square root overflows SD59x18.

#### Parameters

| Name | Type   | Description |
| ---- | ------ | ----------- |
| x    | int256 | undefined   |

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
