# Pausable

_Contract module which allows children to implement an emergency stop mechanism that can be triggered by an authorized account. This module is used through inheritance. It will make available the modifiers `whenNotPaused` and `whenPaused`, which can be applied to the functions of your contract. Note that they will not be pausable by simply including this module, only once the modifiers are put in place._

## Methods

### paused

```solidity
function paused() external view returns (bool)
```

_Returns true if the contract is paused, and false otherwise._

#### Returns

| Name | Type | Description |
| ---- | ---- | ----------- |
| \_0  | bool | undefined   |

## Events

### Paused

```solidity
event Paused(address account)
```

_Emitted when the pause is triggered by `account`._

#### Parameters

| Name    | Type    | Description |
| ------- | ------- | ----------- |
| account | address | undefined   |

### Unpaused

```solidity
event Unpaused(address account)
```

_Emitted when the pause is lifted by `account`._

#### Parameters

| Name    | Type    | Description |
| ------- | ------- | ----------- |
| account | address | undefined   |
