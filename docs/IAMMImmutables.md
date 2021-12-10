# IAMMImmutables



> Pool state that never changes

These parameters are fixed for a amm forever, i.e., the methods will always return the same values



## Methods

### calculator

```solidity
function calculator() external view returns (contract IMarginCalculator)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IMarginCalculator | undefined

### factory

```solidity
function factory() external view returns (address)
```

The contract that deployed the amm, which must adhere to the Factory interface




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | The contract address

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

### underlyingToken

```solidity
function underlyingToken() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined




