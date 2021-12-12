# MockTimeAMM









## Methods

### advanceTime

```solidity
function advanceTime(uint256 by) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| by | uint256 | undefined

### burn

```solidity
function burn(int24 tickLower, int24 tickUpper, uint128 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tickLower | int24 | undefined
| tickUpper | int24 | undefined
| amount | uint128 | undefined

### calculator

```solidity
function calculator() external view returns (contract IMarginCalculator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IMarginCalculator | undefined

### collectProtocol

```solidity
function collectProtocol(address recipient) external nonpayable returns (uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

### factory

```solidity
function factory() external view returns (address)
```

The contract that deployed the amm, which must adhere to the Factory interface




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getFixedTokenGrowthGlobal

```solidity
function getFixedTokenGrowthGlobal() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### getSlot0

```solidity
function getSlot0() external view returns (struct IVAMM.Slot0)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | IVAMM.Slot0 | undefined

### getVariableTokenGrowthGlobal

```solidity
function getVariableTokenGrowthGlobal() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### liquidatePosition

```solidity
function liquidatePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IPositionStructs.ModifyPositionParams | undefined

### liquidateTrader

```solidity
function liquidateTrader(address traderAddress) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| traderAddress | address | undefined

### marginEngine

```solidity
function marginEngine() external view returns (contract IMarginEngine)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IMarginEngine | undefined

### mint

```solidity
function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined
| tickLower | int24 | undefined
| tickUpper | int24 | undefined
| amount | uint128 | undefined

### paused

```solidity
function paused() external view returns (bool)
```



*Returns true if the contract is paused, and false otherwise.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### rateOracle

```solidity
function rateOracle() external view returns (contract IRateOracle)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IRateOracle | undefined

### rateOracleId

```solidity
function rateOracleId() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### setFeeProtocol

```solidity
function setFeeProtocol(uint256 feeProtocol) external nonpayable
```

Set the proportion of LP fees used as protocols fees



#### Parameters

| Name | Type | Description |
|---|---|---|
| feeProtocol | uint256 | new protocol fee

### setMarginEngine

```solidity
function setMarginEngine(address _marginEngine) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _marginEngine | address | undefined

### setUnlocked

```solidity
function setUnlocked(bool _unlocked) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _unlocked | bool | undefined

### setVAMM

```solidity
function setVAMM(address _vAMMAddress) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vAMMAddress | address | undefined

### settlePosition

```solidity
function settlePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IPositionStructs.ModifyPositionParams | undefined

### settleTrader

```solidity
function settleTrader(address recipient) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined

### swap

```solidity
function swap(IVAMM.SwapParams params) external nonpayable returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IVAMM.SwapParams | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _fixedTokenDelta | int256 | undefined
| _variableTokenDelta | int256 | undefined

### termEndTimestamp

```solidity
function termEndTimestamp() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### termStartTimestamp

```solidity
function termStartTimestamp() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### time

```solidity
function time() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### underlyingToken

```solidity
function underlyingToken() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### unlocked

```solidity
function unlocked() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### updatePositionMargin

```solidity
function updatePositionMargin(IPositionStructs.ModifyPositionParams params, int256 marginDelta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IPositionStructs.ModifyPositionParams | undefined
| marginDelta | int256 | undefined

### updateTraderMargin

```solidity
function updateTraderMargin(address recipient, int256 marginDelta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined
| marginDelta | int256 | undefined

### vamm

```solidity
function vamm() external view returns (contract IVAMM)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVAMM | undefined



## Events

### Paused

```solidity
event Paused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

### Unpaused

```solidity
event Unpaused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |



