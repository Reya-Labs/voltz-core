# IAaveV2LendingPool









## Methods

### deposit

```solidity
function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| asset | address | undefined
| amount | uint256 | undefined
| onBehalfOf | address | undefined
| referralCode | uint16 | undefined

### getReserveData

```solidity
function getReserveData(address asset) external view returns (struct IAaveV2LendingPool.ReserveData)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| asset | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | IAaveV2LendingPool.ReserveData | undefined

### getReserveNormalizedIncome

```solidity
function getReserveNormalizedIncome(address underlyingAsset) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlyingAsset | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getUserAccountData

```solidity
function getUserAccountData(address user) external view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)
```



*Returns the user account data across all the reserves*

#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | The address of the user

#### Returns

| Name | Type | Description |
|---|---|---|
| totalCollateralETH | uint256 | the total collateral in ETH of the user
| totalDebtETH | uint256 | the total debt in ETH of the user
| availableBorrowsETH | uint256 | the borrowing power left of the user
| currentLiquidationThreshold | uint256 | the liquidation threshold of the user
| ltv | uint256 | the loan to value of the user
| healthFactor | uint256 | the current health factor of the user*




