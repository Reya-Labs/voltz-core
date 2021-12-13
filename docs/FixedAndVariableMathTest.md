# FixedAndVariableMathTest









## Methods

### accrualFact

```solidity
function accrualFact(uint256 timeInSeconds) external pure returns (uint256 timeInYears)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| timeInSeconds | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| timeInYears | uint256 | undefined

### calculateFixedTokenBalance

```solidity
function calculateFixedTokenBalance(int256 amount0, int256 excessBalance, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (int256 fixedTokenBalance)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount0 | int256 | undefined
| excessBalance | int256 | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| fixedTokenBalance | int256 | undefined

### calculateSettlementCashflow

```solidity
function calculateSettlementCashflow(int256 fixedTokenBalance, int256 variableTokenBalance, uint256 termStartTimestamp, uint256 termEndTimestamp, uint256 variableFactorToMaturity) external view returns (int256 cashflow)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fixedTokenBalance | int256 | undefined
| variableTokenBalance | int256 | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined
| variableFactorToMaturity | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| cashflow | int256 | undefined

### fixedFactor

```solidity
function fixedFactor(bool atMaturity, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (uint256 fixedFactorValue)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| atMaturity | bool | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| fixedFactorValue | uint256 | undefined

### getExcessBalance

```solidity
function getExcessBalance(int256 amount0, int256 amount1, uint256 accruedVariableFactor, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (int256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount0 | int256 | undefined
| amount1 | int256 | undefined
| accruedVariableFactor | uint256 | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getFixedTokenBalance

```solidity
function getFixedTokenBalance(int256 amount0, int256 amount1, uint256 accruedVariableFactor, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (int256 fixedTokenBalance)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount0 | int256 | undefined
| amount1 | int256 | undefined
| accruedVariableFactor | uint256 | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| fixedTokenBalance | int256 | undefined




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


