# PositionTest









## Methods

### calculateFixedAndVariableDelta

```solidity
function calculateFixedAndVariableDelta(int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) external view returns (int256 _fixedTokenBalance, int256 _variableTokenBalance)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fixedTokenGrowthInside | int256 | undefined
| variableTokenGrowthInside | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _fixedTokenBalance | int256 | undefined
| _variableTokenBalance | int256 | undefined

### position

```solidity
function position() external view returns (uint128 _liquidity, int256 margin, int256 fixedTokenGrowthInsideLast, int256 variableTokenGrowthInsideLast, int256 fixedTokenBalance, int256 variableTokenBalance, uint256 feeGrowthInsideLast, bool isBurned)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _liquidity | uint128 | undefined
| margin | int256 | undefined
| fixedTokenGrowthInsideLast | int256 | undefined
| variableTokenGrowthInsideLast | int256 | undefined
| fixedTokenBalance | int256 | undefined
| variableTokenBalance | int256 | undefined
| feeGrowthInsideLast | uint256 | undefined
| isBurned | bool | undefined

### updateBalances

```solidity
function updateBalances(int256 fixedTokenBalanceDelta, int256 variableTokenBalanceDelta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fixedTokenBalanceDelta | int256 | undefined
| variableTokenBalanceDelta | int256 | undefined

### updateFixedAndVariableTokenGrowthInside

```solidity
function updateFixedAndVariableTokenGrowthInside(int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fixedTokenGrowthInside | int256 | undefined
| variableTokenGrowthInside | int256 | undefined

### updateLiquidity

```solidity
function updateLiquidity(int128 liquidityDelta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| liquidityDelta | int128 | undefined

### updateMargin

```solidity
function updateMargin(int256 marginDelta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| marginDelta | int256 | undefined




## Errors

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

### PRBMath__MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |


