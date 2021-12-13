# MarginCalculatorTest









## Methods

### SECONDS_IN_YEAR

```solidity
function SECONDS_IN_YEAR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getMarginCalculatorParametersTest

```solidity
function getMarginCalculatorParametersTest(bytes32 rateOracleId) external view returns (uint256 apyUpperMultiplier, uint256 apyLowerMultiplier, uint256 minDeltaLM, uint256 minDeltaIM, uint256 maxLeverage, int256 sigmaSquared, int256 alpha, int256 beta, int256 xiUpper, int256 xiLower)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| rateOracleId | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| apyUpperMultiplier | uint256 | undefined
| apyLowerMultiplier | uint256 | undefined
| minDeltaLM | uint256 | undefined
| minDeltaIM | uint256 | undefined
| maxLeverage | uint256 | undefined
| sigmaSquared | int256 | undefined
| alpha | int256 | undefined
| beta | int256 | undefined
| xiUpper | int256 | undefined
| xiLower | int256 | undefined

### getMinimumMarginRequirement

```solidity
function getMinimumMarginRequirement(IMarginCalculator.TraderMarginRequirementParams params) external view returns (uint256 margin)
```

Returns the Minimum Margin Requirement

*As a safety measure, Voltz Protocol also computes the minimum margin requirement for FTs and VTs.This ensures the protocol has a cap on the amount of leverage FTs and VTs can takeMinimum Margin = abs(varaibleTokenBalance) * minDelta * tminDelta is a parameter that is set separately for FTs and VTs and it is free to vary depending on the underlying rates poolAlso the minDelta is different for Liquidation and Initial Margin Requirementswhere minDeltaIM &gt; minDeltaLM*

#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.TraderMarginRequirementParams | Values necessary for the purposes of the computation of the Trader Margin Requirement

#### Returns

| Name | Type | Description |
|---|---|---|
| margin | uint256 | Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens    

### getPositionMarginRequirement

```solidity
function getPositionMarginRequirement(IMarginCalculator.PositionMarginRequirementParams params) external view returns (uint256 margin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.PositionMarginRequirementParams | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| margin | uint256 | undefined

### getTraderMarginRequirement

```solidity
function getTraderMarginRequirement(IMarginCalculator.TraderMarginRequirementParams params) external view returns (uint256 margin)
```

Returns either the Liquidation or Initial Margin Requirement of a given trader



#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.TraderMarginRequirementParams | Values necessary for the purposes of the computation of the Trader Margin Requirement

#### Returns

| Name | Type | Description |
|---|---|---|
| margin | uint256 | Either Liquidation or Initial Margin Requirement of a given trader in terms of the underlying tokens

### isLiquidatablePosition

```solidity
function isLiquidatablePosition(IMarginCalculator.PositionMarginRequirementParams params, int256 currentMargin) external view returns (bool _isLiquidatable)
```

Checks if a given position is liquidatable

*In order for a position to be liquidatable its current margin needs to be lower than the position&#39;s liquidation margin requirement*

#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.PositionMarginRequirementParams | undefined
| currentMargin | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _isLiquidatable | bool | A boolean which suggests if a given position is liquidatable

### isLiquidatableTrader

```solidity
function isLiquidatableTrader(IMarginCalculator.TraderMarginRequirementParams params, int256 currentMargin) external view returns (bool isLiquidatable)
```

Checks if a given trader is liquidatable



#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.TraderMarginRequirementParams | Values necessary for the purposes of the computation of the Trader Margin Requirement
| currentMargin | int256 | Current margin of a trader in terms of the underlying tokens (18 decimals)

#### Returns

| Name | Type | Description |
|---|---|---|
| isLiquidatable | bool | A boolean which suggests if a given trader is liquidatable

### setMarginCalculatorParameters

```solidity
function setMarginCalculatorParameters(IMarginCalculator.MarginCalculatorParameters marginCalculatorParameters, bytes32 rateOracleId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| marginCalculatorParameters | IMarginCalculator.MarginCalculatorParameters | undefined
| rateOracleId | bytes32 | undefined

### setMarginCalculatorParametersTest

```solidity
function setMarginCalculatorParametersTest(bytes32 rateOracleId, uint256 apyUpperMultiplier, uint256 apyLowerMultiplier, uint256 minDeltaLM, uint256 minDeltaIM, uint256 maxLeverage, int256 sigmaSquared, int256 alpha, int256 beta, int256 xiUpper, int256 xiLower) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| rateOracleId | bytes32 | undefined
| apyUpperMultiplier | uint256 | undefined
| apyLowerMultiplier | uint256 | undefined
| minDeltaLM | uint256 | undefined
| minDeltaIM | uint256 | undefined
| maxLeverage | uint256 | undefined
| sigmaSquared | int256 | undefined
| alpha | int256 | undefined
| beta | int256 | undefined
| xiUpper | int256 | undefined
| xiLower | int256 | undefined




## Errors

### PRBMathSD59x18__DivInputTooSmall

```solidity
error PRBMathSD59x18__DivInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.




### PRBMathSD59x18__DivOverflow

```solidity
error PRBMathSD59x18__DivOverflow(uint256 rAbs)
```

Emitted when one of the intermediary unsigned results overflows SD59x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| rAbs | uint256 | undefined |

### PRBMathSD59x18__MulInputTooSmall

```solidity
error PRBMathSD59x18__MulInputTooSmall()
```

Emitted when one of the inputs is MIN_SD59x18.




### PRBMathSD59x18__MulOverflow

```solidity
error PRBMathSD59x18__MulOverflow(uint256 rAbs)
```

Emitted when the intermediary absolute result overflows SD59x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| rAbs | uint256 | undefined |

### PRBMathSD59x18__SqrtNegativeInput

```solidity
error PRBMathSD59x18__SqrtNegativeInput(int256 x)
```

Emitted when the input is negative.



#### Parameters

| Name | Type | Description |
|---|---|---|
| x | int256 | undefined |

### PRBMathSD59x18__SqrtOverflow

```solidity
error PRBMathSD59x18__SqrtOverflow(int256 x)
```

Emitted when the calculating the square root overflows SD59x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| x | int256 | undefined |

### PRBMathUD60x18__SubUnderflow

```solidity
error PRBMathUD60x18__SubUnderflow(uint256 x, uint256 y)
```

Emitted when subtraction underflows UD60x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| x | uint256 | undefined |
| y | uint256 | undefined |

### PRBMath__MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |

### PRBMath__MulDivOverflow

```solidity
error PRBMath__MulDivOverflow(uint256 prod1, uint256 denominator)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |
| denominator | uint256 | undefined |


