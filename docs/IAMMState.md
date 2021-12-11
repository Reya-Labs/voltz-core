# IAMMState

> AMM state that can change

These methods compose the amm&#39;s state, and can change with any frequency including multiple times per transaction

## Methods

### getFixedTokenGrowthGlobal

```solidity
function getFixedTokenGrowthGlobal() external view returns (int256)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | int256 | undefined   |

### getSlot0

```solidity
function getSlot0() external view returns (struct IVAMM.Slot0)
```

#### Returns

| Name | Type        | Description |
| ---- | ----------- | ----------- |
| \_0  | IVAMM.Slot0 | undefined   |

### getVariableTokenGrowthGlobal

```solidity
function getVariableTokenGrowthGlobal() external view returns (int256)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | int256 | undefined   |

### marginEngine

```solidity
function marginEngine() external nonpayable returns (contract IMarginEngine)
```

#### Returns

| Name | Type                   | Description |
| ---- | ---------------------- | ----------- |
| \_0  | contract IMarginEngine | undefined   |

### unlocked

```solidity
function unlocked() external nonpayable returns (bool)
```

#### Returns

| Name | Type | Description |
| ---- | ---- | ----------- |
| \_0  | bool | undefined   |

### vamm

```solidity
function vamm() external view returns (contract IVAMM)
```

#### Returns

| Name | Type           | Description |
| ---- | -------------- | ----------- |
| \_0  | contract IVAMM | undefined   |
