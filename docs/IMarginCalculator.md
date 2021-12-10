# IMarginCalculator









## Methods

### SECONDS_IN_YEAR

```solidity
function SECONDS_IN_YEAR() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.TraderMarginRequirementParams | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| margin | uint256 | undefined

### isLiquidatablePosition

```solidity
function isLiquidatablePosition(IMarginCalculator.PositionMarginRequirementParams params, int256 currentMargin) external view returns (bool _isLiquidatable)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.PositionMarginRequirementParams | undefined
| currentMargin | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _isLiquidatable | bool | undefined

### isLiquidatableTrader

```solidity
function isLiquidatableTrader(IMarginCalculator.TraderMarginRequirementParams params, int256 currentMargin) external view returns (bool isLiquidatable)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IMarginCalculator.TraderMarginRequirementParams | undefined
| currentMargin | int256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| isLiquidatable | bool | undefined




