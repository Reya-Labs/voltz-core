# MarginEngineHelpers









## Methods

### calculateLiquidatorRewardAndUpdatedMargin

```solidity
function calculateLiquidatorRewardAndUpdatedMargin(int256 traderMargin, uint256 liquidatorRewardAsProportionOfMargin) external pure returns (uint256 liquidatorReward, int256 updatedMargin)
```

Calculate the liquidator reward and the updated trader margin

*liquidatorReward = traderMargin * LIQUIDATOR_REWARDupdatedMargin = traderMargin - liquidatorReward*

#### Parameters

| Name | Type | Description |
|---|---|---|
| traderMargin | int256 | Current margin of the trader
| liquidatorRewardAsProportionOfMargin | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| liquidatorReward | uint256 | Liquidator Reward as a proportion of the traderMargin
| updatedMargin | int256 | Trader margin net the liquidatorReward

### checkPositionMarginCanBeUpdated

```solidity
function checkPositionMarginCanBeUpdated(IPositionStructs.ModifyPositionParams params, int256 updatedMarginWouldBe, bool isPositionBurned, uint128 positionLiquidity, int256 positionFixedTokenBalance, int256 positionVariableTokenBalance, uint256 variableFactor, address ammAddress) external view
```

Check if the position margin can be updated

*If the current timestamp is higher than the maturity timestamp of the AMM, then the position needs to be burned (detailed definition above)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| params | IPositionStructs.ModifyPositionParams | Position owner, position tickLower, position tickUpper, _
| updatedMarginWouldBe | int256 | Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
| isPositionBurned | bool | The precise definition of a burn position is a position which has zero active liquidity in the vAMM and has settled the IRS cashflows post AMM maturity
| positionLiquidity | uint128 | Current liquidity supplied by the position
| positionFixedTokenBalance | int256 | Fixed token balance of a position since the last mint/burn/poke
| positionVariableTokenBalance | int256 | Variable token balance of a position since the last mint/burn/poke
| variableFactor | uint256 | Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now 
| ammAddress | address | undefined

### checkTraderMarginCanBeUpdated

```solidity
function checkTraderMarginCanBeUpdated(int256 updatedMarginWouldBe, int256 fixedTokenBalance, int256 variableTokenBalance, bool isTraderSettled, address ammAddress) external view
```

Check if the trader margin is above the Initial Margin Requirement

*Reverts if trader&#39;s margin is below the requirementTrader&#39;s margin cannot be updated unless the trader is settledIf the current block timestamp is higher than the term end timestamp of the IRS AMM then the trader needs to be settled to be able to update their marginIf the AMM has already expired and the trader is settled then the trader can withdraw their margin*

#### Parameters

| Name | Type | Description |
|---|---|---|
| updatedMarginWouldBe | int256 | Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
| fixedTokenBalance | int256 | Current fixed token balance of a trader
| variableTokenBalance | int256 | Current variable token balance of a trader
| isTraderSettled | bool | Is the Trader settled, i.e. has the trader settled their IRS cashflows post IRS AMM maturity
| ammAddress | address | undefined




## Errors

### PRBMath__MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.



#### Parameters

| Name | Type | Description |
|---|---|---|
| prod1 | uint256 | undefined |


