# IVAMM

## Methods

### amm

```solidity
function amm() external view returns (contract IAMM)
```

#### Returns

| Name | Type          | Description |
| ---- | ------------- | ----------- |
| \_0  | contract IAMM | undefined   |

### burn

```solidity
function burn(int24 tickLower, int24 tickUpper, uint128 amount) external nonpayable
```

#### Parameters

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| tickLower | int24   | undefined   |
| tickUpper | int24   | undefined   |
| amount    | uint128 | undefined   |

### computePositionFixedAndVariableGrowthInside

```solidity
function computePositionFixedAndVariableGrowthInside(IPositionStructs.ModifyPositionParams params, int24 currentTick) external view returns (int256 fixedTokenGrowthInside, int256 variableTokenGrowthInside)
```

#### Parameters

| Name        | Type                                  | Description |
| ----------- | ------------------------------------- | ----------- |
| params      | IPositionStructs.ModifyPositionParams | undefined   |
| currentTick | int24                                 | undefined   |

#### Returns

| Name                      | Type   | Description |
| ------------------------- | ------ | ----------- |
| fixedTokenGrowthInside    | int256 | undefined   |
| variableTokenGrowthInside | int256 | undefined   |

### fee

```solidity
function fee() external view returns (uint256)
```

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### feeGrowthGlobal

```solidity
function feeGrowthGlobal() external view returns (uint256)
```

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### fixedTokenGrowthGlobal

```solidity
function fixedTokenGrowthGlobal() external view returns (int256)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | int256 | undefined   |

### initialize

```solidity
function initialize(uint160 sqrtPriceX96) external nonpayable
```

#### Parameters

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| sqrtPriceX96 | uint160 | undefined   |

### liquidity

```solidity
function liquidity() external view returns (uint128)
```

The currently in range liquidity available to the vamm

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint128 | undefined   |

### maxLiquidityPerTick

```solidity
function maxLiquidityPerTick() external view returns (uint128)
```

The maximum amount of position liquidity that can use any tick in the range

_This parameter is enforced per tick to prevent liquidity from overflowing a uint128 at any point, and also prevents out-of-range liquidity from being used to prevent adding in-range liquidity to an amm_

#### Returns

| Name | Type    | Description                          |
| ---- | ------- | ------------------------------------ |
| \_0  | uint128 | The max amount of liquidity per tick |

### mint

```solidity
function mint(address recipient, int24 tickLower, int24 tickUpper, uint128 amount) external nonpayable
```

#### Parameters

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| recipient | address | undefined   |
| tickLower | int24   | undefined   |
| tickUpper | int24   | undefined   |
| amount    | uint128 | undefined   |

### protocolFees

```solidity
function protocolFees() external view returns (uint256)
```

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### setAMM

```solidity
function setAMM(address _ammAddress) external nonpayable
```

#### Parameters

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| \_ammAddress | address | undefined   |

### setFeeProtocol

```solidity
function setFeeProtocol(uint256 feeProtocol) external nonpayable
```

#### Parameters

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| feeProtocol | uint256 | undefined   |

### slot0

```solidity
function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint256 feeProtocol)
```

#### Returns

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| sqrtPriceX96 | uint160 | undefined   |
| tick         | int24   | undefined   |
| feeProtocol  | uint256 | undefined   |

### swap

```solidity
function swap(IVAMM.SwapParams params) external nonpayable returns (int256 _fixedTokenDelta, int256 _variableTokenDelta)
```

#### Parameters

| Name   | Type             | Description |
| ------ | ---------------- | ----------- |
| params | IVAMM.SwapParams | undefined   |

#### Returns

| Name                 | Type   | Description |
| -------------------- | ------ | ----------- |
| \_fixedTokenDelta    | int256 | undefined   |
| \_variableTokenDelta | int256 | undefined   |

### tickBitmap

```solidity
function tickBitmap(int16 wordPosition) external view returns (uint256)
```

Returns 256 packed tick initialized boolean values. See TickBitmap for more information

#### Parameters

| Name         | Type  | Description |
| ------------ | ----- | ----------- |
| wordPosition | int16 | undefined   |

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### tickSpacing

```solidity
function tickSpacing() external view returns (int24)
```

The vamm tick spacing

_Ticks can only be used at multiples of this value, minimum of 1 and always positive e.g.: a tickSpacing of 3 means ticks can be initialized every 3rd tick, i.e., ..., -6, -3, 0, 3, 6, ... This value is an int24 to avoid casting even though it is always positive._

#### Returns

| Name | Type  | Description      |
| ---- | ----- | ---------------- |
| \_0  | int24 | The tick spacing |

### ticks

```solidity
function ticks(int24 tick) external view returns (uint128 liquidityGross, int128 liquidityNet, int256 fixedTokenGrowthOutside, int256 variableTokenGrowthOutside, uint256 feeGrowthOutside, bool initialized)
```

Look up information about a specific tick in the amm

#### Parameters

| Name | Type  | Description         |
| ---- | ----- | ------------------- |
| tick | int24 | The tick to look up |

#### Returns

| Name                       | Type    | Description                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| liquidityGross             | uint128 | the total amount of position liquidity that uses the amm either as tick lower or tick upper, liquidityNet how much liquidity changes when the amm price crosses the tick, feeGrowthOutsideX128 the fee growth on the other side of the tick from the current tick in underlying Token i.e. if liquidityGross is greater than 0. In addition, these values are only relative and are used to compute snapshots. |
| liquidityNet               | int128  | undefined                                                                                                                                                                                                                                                                                                                                                                                                      |
| fixedTokenGrowthOutside    | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                      |
| variableTokenGrowthOutside | int256  | undefined                                                                                                                                                                                                                                                                                                                                                                                                      |
| feeGrowthOutside           | uint256 | undefined                                                                                                                                                                                                                                                                                                                                                                                                      |
| initialized                | bool    | undefined                                                                                                                                                                                                                                                                                                                                                                                                      |

### updateProtocolFees

```solidity
function updateProtocolFees(uint256 protocolFeesCollected) external nonpayable
```

#### Parameters

| Name                  | Type    | Description |
| --------------------- | ------- | ----------- |
| protocolFeesCollected | uint256 | undefined   |

### variableTokenGrowthGlobal

```solidity
function variableTokenGrowthGlobal() external view returns (int256)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | int256 | undefined   |

## Events

### Initialize

```solidity
event Initialize(uint160 sqrtPriceX96, int24 tick)
```

#### Parameters

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| sqrtPriceX96 | uint160 | undefined   |
| tick         | int24   | undefined   |

### Mint

```solidity
event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount)
```

#### Parameters

| Name                | Type    | Description |
| ------------------- | ------- | ----------- |
| sender              | address | undefined   |
| owner `indexed`     | address | undefined   |
| tickLower `indexed` | int24   | undefined   |
| tickUpper `indexed` | int24   | undefined   |
| amount              | uint128 | undefined   |

### Swap

```solidity
event Swap(address indexed sender, address indexed recipient, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)
```

#### Parameters

| Name                | Type    | Description |
| ------------------- | ------- | ----------- |
| sender `indexed`    | address | undefined   |
| recipient `indexed` | address | undefined   |
| sqrtPriceX96        | uint160 | undefined   |
| liquidity           | uint128 | undefined   |
| tick                | int24   | undefined   |
