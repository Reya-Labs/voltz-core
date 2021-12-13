# IMarginCalculator









## Methods

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




