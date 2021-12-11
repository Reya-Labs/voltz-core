# Errors

_Aave_

> Errors library

Defines the error messages emitted by the different contracts of the Aave protocol

_Error messages prefix glossary: - VL = ValidationLogic - MATH = Math libraries - CT = Common errors between tokens (AToken, VariableDebtToken and StableDebtToken) - AT = AToken - SDT = StableDebtToken - VDT = VariableDebtToken - LP = LendingPool - LPAPR = LendingPoolAddressesProviderRegistry - LPC = LendingPoolConfiguration - RL = ReserveLogic - LPCM = LendingPoolCollateralManager - P = Pausable_

## Methods

### BORROW_ALLOWANCE_NOT_ENOUGH

```solidity
function BORROW_ALLOWANCE_NOT_ENOUGH() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CALLER_NOT_POOL_ADMIN

```solidity
function CALLER_NOT_POOL_ADMIN() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CT_CALLER_MUST_BE_LENDING_POOL

```solidity
function CT_CALLER_MUST_BE_LENDING_POOL() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF

```solidity
function CT_CANNOT_GIVE_ALLOWANCE_TO_HIMSELF() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CT_INVALID_BURN_AMOUNT

```solidity
function CT_INVALID_BURN_AMOUNT() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CT_INVALID_MINT_AMOUNT

```solidity
function CT_INVALID_MINT_AMOUNT() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### CT_TRANSFER_AMOUNT_NOT_GT_0

```solidity
function CT_TRANSFER_AMOUNT_NOT_GT_0() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPAPR_INVALID_ADDRESSES_PROVIDER_ID

```solidity
function LPAPR_INVALID_ADDRESSES_PROVIDER_ID() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPAPR_PROVIDER_NOT_REGISTERED

```solidity
function LPAPR_PROVIDER_NOT_REGISTERED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED

```solidity
function LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD

```solidity
function LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE

```solidity
function LPCM_NOT_ENOUGH_LIQUIDITY_TO_LIQUIDATE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPCM_NO_ERRORS

```solidity
function LPCM_NO_ERRORS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER

```solidity
function LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_CALLER_NOT_EMERGENCY_ADMIN

```solidity
function LPC_CALLER_NOT_EMERGENCY_ADMIN() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_ADDRESSES_PROVIDER_ID

```solidity
function LPC_INVALID_ADDRESSES_PROVIDER_ID() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_ATOKEN_POOL_ADDRESS

```solidity
function LPC_INVALID_ATOKEN_POOL_ADDRESS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_CONFIGURATION

```solidity
function LPC_INVALID_CONFIGURATION() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS

```solidity
function LPC_INVALID_STABLE_DEBT_TOKEN_POOL_ADDRESS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS

```solidity
function LPC_INVALID_STABLE_DEBT_TOKEN_UNDERLYING_ADDRESS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS

```solidity
function LPC_INVALID_VARIABLE_DEBT_TOKEN_POOL_ADDRESS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS

```solidity
function LPC_INVALID_VARIABLE_DEBT_TOKEN_UNDERLYING_ADDRESS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LPC_RESERVE_LIQUIDITY_NOT_0

```solidity
function LPC_RESERVE_LIQUIDITY_NOT_0() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_CALLER_MUST_BE_AN_ATOKEN

```solidity
function LP_CALLER_MUST_BE_AN_ATOKEN() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR

```solidity
function LP_CALLER_NOT_LENDING_POOL_CONFIGURATOR() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_FAILED_COLLATERAL_SWAP

```solidity
function LP_FAILED_COLLATERAL_SWAP() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_FAILED_REPAY_WITH_COLLATERAL

```solidity
function LP_FAILED_REPAY_WITH_COLLATERAL() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INCONSISTENT_FLASHLOAN_PARAMS

```solidity
function LP_INCONSISTENT_FLASHLOAN_PARAMS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INCONSISTENT_PARAMS_LENGTH

```solidity
function LP_INCONSISTENT_PARAMS_LENGTH() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INCONSISTENT_PROTOCOL_ACTUAL_BALANCE

```solidity
function LP_INCONSISTENT_PROTOCOL_ACTUAL_BALANCE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET

```solidity
function LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INVALID_EQUAL_ASSETS_TO_SWAP

```solidity
function LP_INVALID_EQUAL_ASSETS_TO_SWAP() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INVALID_FLASHLOAN_MODE

```solidity
function LP_INVALID_FLASHLOAN_MODE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN

```solidity
function LP_INVALID_FLASH_LOAN_EXECUTOR_RETURN() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_IS_PAUSED

```solidity
function LP_IS_PAUSED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_LIQUIDATION_CALL_FAILED

```solidity
function LP_LIQUIDATION_CALL_FAILED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_NOT_CONTRACT

```solidity
function LP_NOT_CONTRACT() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_NOT_ENOUGH_LIQUIDITY_TO_BORROW

```solidity
function LP_NOT_ENOUGH_LIQUIDITY_TO_BORROW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_NOT_ENOUGH_STABLE_BORROW_BALANCE

```solidity
function LP_NOT_ENOUGH_STABLE_BORROW_BALANCE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_NO_MORE_RESERVES_ALLOWED

```solidity
function LP_NO_MORE_RESERVES_ALLOWED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_REENTRANCY_NOT_ALLOWED

```solidity
function LP_REENTRANCY_NOT_ALLOWED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### LP_REQUESTED_AMOUNT_TOO_SMALL

```solidity
function LP_REQUESTED_AMOUNT_TOO_SMALL() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### MATH_ADDITION_OVERFLOW

```solidity
function MATH_ADDITION_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### MATH_DIVISION_BY_ZERO

```solidity
function MATH_DIVISION_BY_ZERO() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### MATH_MULTIPLICATION_OVERFLOW

```solidity
function MATH_MULTIPLICATION_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RC_INVALID_DECIMALS

```solidity
function RC_INVALID_DECIMALS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RC_INVALID_LIQ_BONUS

```solidity
function RC_INVALID_LIQ_BONUS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RC_INVALID_LIQ_THRESHOLD

```solidity
function RC_INVALID_LIQ_THRESHOLD() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RC_INVALID_LTV

```solidity
function RC_INVALID_LTV() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RC_INVALID_RESERVE_FACTOR

```solidity
function RC_INVALID_RESERVE_FACTOR() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_LIQUIDITY_INDEX_OVERFLOW

```solidity
function RL_LIQUIDITY_INDEX_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_LIQUIDITY_RATE_OVERFLOW

```solidity
function RL_LIQUIDITY_RATE_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_RESERVE_ALREADY_INITIALIZED

```solidity
function RL_RESERVE_ALREADY_INITIALIZED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_STABLE_BORROW_RATE_OVERFLOW

```solidity
function RL_STABLE_BORROW_RATE_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_VARIABLE_BORROW_INDEX_OVERFLOW

```solidity
function RL_VARIABLE_BORROW_INDEX_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### RL_VARIABLE_BORROW_RATE_OVERFLOW

```solidity
function RL_VARIABLE_BORROW_RATE_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### SDT_BURN_EXCEEDS_BALANCE

```solidity
function SDT_BURN_EXCEEDS_BALANCE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### SDT_STABLE_DEBT_OVERFLOW

```solidity
function SDT_STABLE_DEBT_OVERFLOW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### UL_INVALID_INDEX

```solidity
function UL_INVALID_INDEX() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE

```solidity
function VL_AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_BORROWING_NOT_ENABLED

```solidity
function VL_BORROWING_NOT_ENABLED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_COLLATERAL_BALANCE_IS_0

```solidity
function VL_COLLATERAL_BALANCE_IS_0() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_COLLATERAL_CANNOT_COVER_NEW_BORROW

```solidity
function VL_COLLATERAL_CANNOT_COVER_NEW_BORROW() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY

```solidity
function VL_COLLATERAL_SAME_AS_BORROWING_CURRENCY() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH

```solidity
function VL_CURRENT_AVAILABLE_LIQUIDITY_NOT_ENOUGH() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_DEPOSIT_ALREADY_IN_USE

```solidity
function VL_DEPOSIT_ALREADY_IN_USE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD

```solidity
function VL_HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_INCONSISTENT_FLASHLOAN_PARAMS

```solidity
function VL_INCONSISTENT_FLASHLOAN_PARAMS() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_INVALID_AMOUNT

```solidity
function VL_INVALID_AMOUNT() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_INVALID_INTEREST_RATE_MODE_SELECTED

```solidity
function VL_INVALID_INTEREST_RATE_MODE_SELECTED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE

```solidity
function VL_NOT_ENOUGH_AVAILABLE_USER_BALANCE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NO_ACTIVE_RESERVE

```solidity
function VL_NO_ACTIVE_RESERVE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NO_DEBT_OF_SELECTED_TYPE

```solidity
function VL_NO_DEBT_OF_SELECTED_TYPE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF

```solidity
function VL_NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NO_STABLE_RATE_LOAN_IN_RESERVE

```solidity
function VL_NO_STABLE_RATE_LOAN_IN_RESERVE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_NO_VARIABLE_RATE_LOAN_IN_RESERVE

```solidity
function VL_NO_VARIABLE_RATE_LOAN_IN_RESERVE() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_RESERVE_FROZEN

```solidity
function VL_RESERVE_FROZEN() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_STABLE_BORROWING_NOT_ENABLED

```solidity
function VL_STABLE_BORROWING_NOT_ENABLED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_TRANSFER_NOT_ALLOWED

```solidity
function VL_TRANSFER_NOT_ALLOWED() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |

### VL_UNDERLYING_BALANCE_NOT_GREATER_THAN_0

```solidity
function VL_UNDERLYING_BALANCE_NOT_GREATER_THAN_0() external view returns (string)
```

#### Returns

| Name | Type   | Description |
| ---- | ------ | ----------- |
| \_0  | string | undefined   |
