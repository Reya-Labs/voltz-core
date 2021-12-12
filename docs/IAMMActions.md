# IAMMActions

## Methods

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

### liquidatePosition

```solidity
function liquidatePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```

#### Parameters

| Name   | Type                                  | Description |
| ------ | ------------------------------------- | ----------- |
| params | IPositionStructs.ModifyPositionParams | undefined   |

### liquidateTrader

```solidity
function liquidateTrader(address traderAddress) external nonpayable
```

#### Parameters

| Name          | Type    | Description |
| ------------- | ------- | ----------- |
| traderAddress | address | undefined   |

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

### setMarginEngine

```solidity
function setMarginEngine(address _marginEngine) external nonpayable
```

#### Parameters

| Name           | Type    | Description |
| -------------- | ------- | ----------- |
| \_marginEngine | address | undefined   |

### setUnlocked

```solidity
function setUnlocked(bool _unlocked) external nonpayable
```

#### Parameters

| Name       | Type | Description |
| ---------- | ---- | ----------- |
| \_unlocked | bool | undefined   |

### setVAMM

```solidity
function setVAMM(address _vAMMAddress) external nonpayable
```

#### Parameters

| Name          | Type    | Description |
| ------------- | ------- | ----------- |
| \_vAMMAddress | address | undefined   |

### settlePosition

```solidity
function settlePosition(IPositionStructs.ModifyPositionParams params) external nonpayable
```

#### Parameters

| Name   | Type                                  | Description |
| ------ | ------------------------------------- | ----------- |
| params | IPositionStructs.ModifyPositionParams | undefined   |

### settleTrader

```solidity
function settleTrader(address recipient) external nonpayable
```

#### Parameters

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| recipient | address | undefined   |

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

### updatePositionMargin

```solidity
function updatePositionMargin(IPositionStructs.ModifyPositionParams params, int256 marginDelta) external nonpayable
```

#### Parameters

| Name        | Type                                  | Description |
| ----------- | ------------------------------------- | ----------- |
| params      | IPositionStructs.ModifyPositionParams | undefined   |
| marginDelta | int256                                | undefined   |

### updateTraderMargin

```solidity
function updateTraderMargin(address recipient, int256 marginDelta) external nonpayable
```

#### Parameters

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| recipient   | address | undefined   |
| marginDelta | int256  | undefined   |
