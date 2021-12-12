# IAaveRateOracle









## Methods

### aaveLendingPool

```solidity
function aaveLendingPool() external nonpayable returns (contract IAaveV2LendingPool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAaveV2LendingPool | undefined

### getRateFromTo

```solidity
function getRateFromTo(address underlying, uint256 from, uint256 to) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | address | undefined
| from | uint256 | undefined
| to | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getReserveNormalizedIncome

```solidity
function getReserveNormalizedIncome(address underlying) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getTwapApy

```solidity
function getTwapApy(address underlying) external view returns (uint256 twapApy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| twapApy | uint256 | undefined

### rateOracleId

```solidity
function rateOracleId() external view returns (bytes32)
```

Gets the bytes32 ID of the rate oracle.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | Returns the rate oracle and protocol identifier.*

### secondsAgo

```solidity
function secondsAgo() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### setSecondsAgo

```solidity
function setSecondsAgo(uint256 _secondsAgo) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _secondsAgo | uint256 | undefined

### updateRate

```solidity
function updateRate(address underlying) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | address | undefined

### variableFactor

```solidity
function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| atMaturity | bool | undefined
| underlyingToken | address | undefined
| termStartTimestamp | uint256 | undefined
| termEndTimestamp | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### writeOrcleEntry

```solidity
function writeOrcleEntry(address underlying) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | address | undefined




