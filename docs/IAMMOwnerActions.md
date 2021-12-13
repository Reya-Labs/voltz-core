# IAMMOwnerActions



> Permissioned amm actions

Contains amm methods that may only be called by the factory owner



## Methods

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

### setFeeProtocol

```solidity
function setFeeProtocol(uint256 feeProtocol) external nonpayable
```

Set the proportion of LP fees used as protocols fees



#### Parameters

| Name | Type | Description |
|---|---|---|
| feeProtocol | uint256 | new protocol fee




