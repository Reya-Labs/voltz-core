# IMarginEngine

## Methods

### amm

```solidity
function amm() external view returns (contract IAMM)
```

Returns the address of the IRS AMM linked to this Margin Engine

#### Returns

| Name | Type          | Description                                           |
| ---- | ------------- | ----------------------------------------------------- |
| \_0  | contract IAMM | Interface of the IRS AMM linked to this Margin Engine |

### checkPositionMarginRequirementSatisfied

```solidity
function checkPositionMarginRequirementSatisfied(address recipient, int24 tickLower, int24 tickUpper, uint128 amount) external nonpayable
```

#### Parameters

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| recipient | address | undefined   |
| tickLower | int24   | undefined   |
| tickUpper | int24   | undefined   |
| amount    | uint128 | undefined   |

### liquidatePosition

```solidity
function liquidatePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```

Liquidate a Position

_Steps to liquidate: update position&#39;s fixed and variable token balances to account for balances accumulated throughout the trades made since the last mint/burn/poke,Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator,Check if the position is liquidatable by calling the isLiquidatablePosition function of the calculator, revert if that is not the case,Calculate the liquidation reward = current margin of the position _ LIQUIDATOR_REWARD, subtract the liquidator reward from the position margin,Burn the position&#39;s liquidity ==&gt; not going to enter into new IRS contracts until the AMM maturity, transfer the reward to the liquidator\*

#### Parameters

| Name   | Type                                  | Description                                                                                               |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| params | IPositionStructs.ModifyPositionParams | necessary for the purposes of referencing the position being liquidated (owner, tickLower, tickUpper, \_) |

### liquidateTrader

```solidity
function liquidateTrader(address traderAddress) external nonpayable
```

Liquidate a Trader

_Steps to liquidate: check if the trader is liquidatable (revert if that is not the case),Calculate liquidator reward, subtract it from the trader margin, unwind the trader, transfer the reward to the liquidator_

#### Parameters

| Name          | Type    | Description                                |
| ------------- | ------- | ------------------------------------------ |
| traderAddress | address | The address of the trader being liquidated |

### positions

```solidity
function positions(bytes32 key) external view returns (uint128 _liquidity, int256 margin, int256 fixedTokenGrowthInsideLast, int256 variableTokenGrowthInsideLast, int256 fixedTokenBalance, int256 variableTokenBalance, uint256 feeGrowthInsideLast, bool isBurned)
```

Returns the information about a position by the position&#39;s key

#### Parameters

| Name | Type    | Description                                                                                   |
| ---- | ------- | --------------------------------------------------------------------------------------------- |
| key  | bytes32 | The position&#39;s key is a hash of a preimage composed by the owner, tickLower and tickUpper |

#### Returns

| Name                          | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \_liquidity                   | uint128 | The amount of liquidity in the position, Returns fixedTokenGrowthInsideLast fixed token growth inside the tick range as of the last mint/burn/poke, Returns variableTokenGrowthInsideLast variable token growth inside the tick range as of the last mint/burn/poke, Returns fixedTokenBalance fixed token balance of the position as of the last mint/burn/poke Returns fixedTokenBalance variable token balance of the position as of the last mint/burn/poke Returns feeGrowthInside1Last fee growth in terms of the underlying token inside the tick range as of the last mint/burn/poke, Returns isBurned position&#39;s liquidity has been burned, hence the LP will not be entering into new IRS contracts until the maturity of the IRS AMM |
| margin                        | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| fixedTokenGrowthInsideLast    | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| variableTokenGrowthInsideLast | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| fixedTokenBalance             | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| variableTokenBalance          | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| feeGrowthInsideLast           | uint256 | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| isBurned                      | bool    | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### setAMM

```solidity
function setAMM(address _ammAddress) external nonpayable
```

Updates the AMM of the Margin Engine

_Must be called by the factory_

#### Parameters

| Name         | Type    | Description                      |
| ------------ | ------- | -------------------------------- |
| \_ammAddress | address | The new AMM of the Margin Engine |

### settlePosition

```solidity
function settlePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```

Settles a Position

_Can be called by anyoneA position cannot be settled before maturitySteps to settle a position:1. Retrieve the current fixed and variable token growth inside the tick range of a position2. Calculate accumulated fixed and variable balances of the position since the last mint/poke/burn3. Update the postion&#39;s fixed and variable token balances4. Update the postion&#39;s fixed and varaible token growth inside last to enable future updates5. Calculates the settlement cashflow from all of the IRS contracts the position has entered since entering the AMM6. Updates the fixed and variable token balances of the position to be zero, adds the settlement cashflow to the position&#39;s current margin_

#### Parameters

| Name   | Type                                  | Description                                                                                                   |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| params | IPositionStructs.ModifyPositionParams | Values necessary for the purposes of referencing the position being settled (owner, tickLower, tickUpper, \_) |

### settleTrader

```solidity
function settleTrader(address recipient) external nonpayable
```

Settles a Trader

_Can be called by anyoneA Trader cannot be settled before IRS AMM maturitySteps to settle: calculate settlement cashflow based on the fixed and variable balances of the trader, update the fixed and variable balances to 0, update the margin to account for IRS settlement cashflow_

#### Parameters

| Name      | Type    | Description                             |
| --------- | ------- | --------------------------------------- |
| recipient | address | The address of the trader being settled |

### traders

```solidity
function traders(bytes32 key) external view returns (int256 margin, int256 fixedTokenBalance, int256 variableTokenBalance, bool settled)
```

Returns the information about a trader by the trader&#39;s key

#### Parameters

| Name | Type    | Description                                                                               |
| ---- | ------- | ----------------------------------------------------------------------------------------- |
| key  | bytes32 | The trader&#39;s key is a hash of a preimage composed by the wallet address of the trader |

#### Returns

| Name                 | Type   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| margin               | int256 | Margin (in terms of the underlying tokens) in the trader&#39;s Voltz account Returns fixedTokenBalance The fixed token balance of the tader, at the maturity this balance (if positive) can be redeemed for fixedTokenBalance _ Term of the AMM in Years _ 1% Returns variableTokenBalance The variable token balance of the tader, at the maturity this balance (if positive) can be redeemed for variableTokenBalance _ Term of the AMM in Years _ variable APY generated by the underlying varaible rates pool over the lifetime of the IRS AMM Returns settled A Trader is considered settled if after the maturity of the IRS AMM, the trader settled the IRS cash-flows generated by their fixed and variable token balances |
| fixedTokenBalance    | int256 | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| variableTokenBalance | int256 | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| settled              | bool   | undefined                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### unwindPosition

```solidity
function unwindPosition(address owner, int24 tickLower, int24 tickUpper) external nonpayable returns (int256 _fixedTokenBalance, int256 _variableTokenBalance)
```

Unwind a position

_Auth: Before unwinding a position, need to check if it is even necessary to unwind it, i.e. check if the most up to date variable token balance of a position is non-zeroIf the current fixed token balance of a position is positive, this implies the position is a net Fixed Taker,Hence to unwind need to enter into a Variable Taker IRS contract with notional = abs(current variable token balance)_

#### Parameters

| Name      | Type    | Description                                     |
| --------- | ------- | ----------------------------------------------- |
| owner     | address | the owner of the position                       |
| tickLower | int24   | the lower tick of the position&#39;s tick range |
| tickUpper | int24   | the upper tick of the position&#39;s tick range |

#### Returns

| Name                   | Type   | Description |
| ---------------------- | ------ | ----------- |
| \_fixedTokenBalance    | int256 | undefined   |
| \_variableTokenBalance | int256 | undefined   |

### updatePosition

```solidity
function updatePosition(IPositionStructs.ModifyPositionParams params, IVAMM.UpdatePositionVars vars) external nonpayable
```

Update a Position

_Steps taken:1. Update position liquidity based on params.liquidityDelta2. Update fixed and variable token balances of the position based on how much has been accumulated since the last mint/burn/poke3. Update position&#39;s margin by taking into account the position accumulated fees since the last mint/burnpoke4. Update fixed and variable token growth + fee growth in the position info struct for future interactions with the position _

#### Parameters

| Name   | Type                                  | Description                                                                                                                                 |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| params | IPositionStructs.ModifyPositionParams | necessary for the purposes of referencing the position being updated (owner, tickLower, tickUpper, \_)                                      |
| vars   | IVAMM.UpdatePositionVars              | Relevant variables from vars: feeGrowthInside, fixedTokenGrowthInside and variabelTokenGrowthInside of the tick range of the given position |

### updatePositionMargin

```solidity
function updatePositionMargin(IPositionStructs.ModifyPositionParams params, int256 marginDelta) external nonpayable
```

Updates Position Margin

_Must be called by the owner of the position (unless marginDelta is positive?)_

#### Parameters

| Name        | Type                                  | Description                                                                                                         |
| ----------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| params      | IPositionStructs.ModifyPositionParams | Values necessary for the purposes of the updating the Position Margin (owner, tickLower, tickUpper, liquidityDelta) |
| marginDelta | int256                                | Determines the updated margin of the position where the updated margin = current margin + marginDelta               |

### updateTraderBalances

```solidity
function updateTraderBalances(address recipient, int256 fixedTokenBalance, int256 variableTokenBalance) external nonpayable
```

Update Fixed and Variable Token Balances of a trader

_Auth: Steps taken:1. Update Fixed and Variable Token Balances of a trader2. Check if the initial margin requirement is still satisfied following the balances update, if that is not the case then revert_

#### Parameters

| Name                 | Type    | Description                                                   |
| -------------------- | ------- | ------------------------------------------------------------- |
| recipient            | address | The address of the trader who wishes to update their balances |
| fixedTokenBalance    | int256  | Current fixed token balance of a trader                       |
| variableTokenBalance | int256  | Current variable token balance of a trader                    |

### updateTraderMargin

```solidity
function updateTraderMargin(address recipient, int256 marginDelta) external nonpayable
```

Updates Trader Margin

_Must be called by the trader address (unless marginDelta is positive?)_

#### Parameters

| Name        | Type    | Description                                                                                         |
| ----------- | ------- | --------------------------------------------------------------------------------------------------- |
| recipient   | address | Address of the trader whose margin we want to update                                                |
| marginDelta | int256  | Determines the updated margin of the trader where the updated margin = current margin + marginDelta |
