# Tick



> Tick

Contains functions for managing tick processes and relevant calculations



## Methods

### checkTicks

```solidity
function checkTicks(int24 tickLower, int24 tickUpper) external pure
```



*Common checks for valid tick inputs.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| tickLower | int24 | undefined
| tickUpper | int24 | undefined




## Errors

### PRBMathUD60x18__AddOverflow

```solidity
error PRBMathUD60x18__AddOverflow(uint256 x, uint256 y)
```

Emitted when addition overflows UD60x18.



#### Parameters

| Name | Type | Description |
|---|---|---|
| x | uint256 | undefined |
| y | uint256 | undefined |

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


