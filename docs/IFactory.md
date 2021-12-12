# IFactory

> The interface for the Voltz AMM Factory

The AMM Factory facilitates creation of Voltz AMMs

## Methods

### addRateOracle

```solidity
function addRateOracle(bytes32 _rateOracleId, address _rateOracleAddress) external nonpayable
```

Adds a new Rate Oracle to the mapping getRateOracleAddress

_The call will revert if the \_rateOracleId is invalid, if the \_rateOracleAddress is invalid, rate oracle with that address has the given id, key/value already exist in the mapping _

#### Parameters

| Name                | Type    | Description                                                                                      |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| \_rateOracleId      | bytes32 | A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound) |
| \_rateOracleAddress | address | Address of the Rate Oracle linked (e.g. Aave v2 Lending Pool)                                    |

### calculator

```solidity
function calculator() external view returns (address)
```

Returns the current calculator of the factory

_Can be changed by the current owner via setCalculator_

#### Returns

| Name | Type    | Description                   |
| ---- | ------- | ----------------------------- |
| \_0  | address | The address of the calculator |

### createAMM

```solidity
function createAMM(address underlyingToken, bytes32 rateOracleId, uint256 termEndTimestamp) external nonpayable returns (address amm)
```

Creates an amm for a given underlying token (e.g. USDC), rateOracleId, and termEndTimestamp

_The call will revert if the amm already exists, underlying token is invalid, the rateOracleId is invalid or the termEndTimeStamp is invalid_

#### Parameters

| Name             | Type    | Description                                                                                      |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------ |
| underlyingToken  | address | The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC)          |
| rateOracleId     | bytes32 | A bytes32 string which links to the correct underlying yield protocol (e.g. Aave v2 or Compound) |
| termEndTimestamp | uint256 | undefined                                                                                        |

#### Returns

| Name | Type    | Description                          |
| ---- | ------- | ------------------------------------ |
| amm  | address | The address of the newly created amm |

### createMarginEngine

```solidity
function createMarginEngine(address ammAddress) external nonpayable returns (address marginEngine)
```

Creates the Margin Engine for a given AMM (core function: overall margin management, i.g. cash-flows, settlements, liquidations)

_The call will revert if the Margin Engine already exists, amm is invalid_

#### Parameters

| Name       | Type    | Description                         |
| ---------- | ------- | ----------------------------------- |
| ammAddress | address | The parent AMM of the Margin Engine |

#### Returns

| Name         | Type    | Description                                    |
| ------------ | ------- | ---------------------------------------------- |
| marginEngine | address | The address of the newly created Margin Engine |

### createVAMM

```solidity
function createVAMM(address ammAddress) external nonpayable returns (address vamm)
```

Creates a concentrated liquidity virtual automated market maker (VAMM) for a given amm

_The call will revert if the VAMM already exists, amm is invalid_

#### Parameters

| Name       | Type    | Description                |
| ---------- | ------- | -------------------------- |
| ammAddress | address | The parent AMM of the VAMM |

#### Returns

| Name | Type    | Description                           |
| ---- | ------- | ------------------------------------- |
| vamm | address | The address of the newly created VAMM |

### getAMMMAp

```solidity
function getAMMMAp(bytes32 rateOracleId, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external view returns (address)
```

Returns the amm address for a given rateOracleId, underlyingToken, termStartTimestamp, termEndTimestamp

#### Parameters

| Name               | Type    | Description                                                                             |
| ------------------ | ------- | --------------------------------------------------------------------------------------- |
| rateOracleId       | bytes32 | The bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)       |
| underlyingToken    | address | The underlying token (e.g. USDC) behind a given yield-bearing pool (e.g. AAve v2 aUSDC) |
| termStartTimestamp | uint256 | The block.timestamp of amm inception                                                    |
| termEndTimestamp   | uint256 | The block.timestamp of amm maturity                                                     |

#### Returns

| Name | Type    | Description         |
| ---- | ------- | ------------------- |
| \_0  | address | amm The amm address |

### getRateOracleAddress

```solidity
function getRateOracleAddress(bytes32 rateOracleId) external view returns (address)
```

Returns the address of the Rate Oracle Contract

#### Parameters

| Name         | Type    | Description                                                                       |
| ------------ | ------- | --------------------------------------------------------------------------------- |
| rateOracleId | bytes32 | The bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2) |

#### Returns

| Name | Type    | Description                             |
| ---- | ------- | --------------------------------------- |
| \_0  | address | The address of the Rate Oracle Contract |

### insuranceFund

```solidity
function insuranceFund() external view returns (address)
```

Returns the current insurance fund of the factory (i.e. Voltz Insurance/Incentives Engine)

_Can be changed by the current owner via setInsuranceFund_

#### Returns

| Name | Type    | Description                          |
| ---- | ------- | ------------------------------------ |
| \_0  | address | The address of the Incentives Engine |

### owner

```solidity
function owner() external view returns (address)
```

Returns the current owner of the factory

_Can be changed by the current owner via setOwner_

#### Returns

| Name | Type    | Description                      |
| ---- | ------- | -------------------------------- |
| \_0  | address | The address of the factory owner |

### setCalculator

```solidity
function setCalculator(address _calculator) external nonpayable
```

Updates the calculator of the factory

_Must be called by the current owner_

#### Parameters

| Name         | Type    | Description                       |
| ------------ | ------- | --------------------------------- |
| \_calculator | address | The new calculator of the factory |

### setInsuranceFund

```solidity
function setInsuranceFund(address _insuranceFund) external nonpayable
```

Updates the Incentives Engine of the factory

_Must be called by the current owner_

#### Parameters

| Name            | Type    | Description                              |
| --------------- | ------- | ---------------------------------------- |
| \_insuranceFund | address | The new Incentives Engine of the factory |

### setOwner

```solidity
function setOwner(address _owner) external nonpayable
```

Updates the owner of the factory

_Must be called by the current owner_

#### Parameters

| Name    | Type    | Description                  |
| ------- | ------- | ---------------------------- |
| \_owner | address | The new owner of the factory |

### setTreasury

```solidity
function setTreasury(address _treasury) external nonpayable
```

Updates the treasury of the factory

_Must be called by the current owner_

#### Parameters

| Name       | Type    | Description                     |
| ---------- | ------- | ------------------------------- |
| \_treasury | address | The new treasury of the factory |

### treasury

```solidity
function treasury() external view returns (address)
```

Returns the current treasury of the factory (i.e. Voltz Treasury)

_Can be changed by the current owner via setTreasury_

#### Returns

| Name | Type    | Description                 |
| ---- | ------- | --------------------------- |
| \_0  | address | The address of the treasury |

## Events

### AMMCreated

```solidity
event AMMCreated(address indexed ammAddress, address indexed tokenAddress, bytes32 indexed rateOracleId, uint256 termStartTimestamp, uint256 termEndTimestamp)
```

Emitted when an AMM is successfully created

#### Parameters

| Name                   | Type    | Description                                                                        |
| ---------------------- | ------- | ---------------------------------------------------------------------------------- |
| ammAddress `indexed`   | address | The new AMM&#39;s address                                                          |
| tokenAddress `indexed` | address | The new AMM&#39;s token                                                            |
| rateOracleId `indexed` | bytes32 | The new AMM&#39;s rate oracle ID in Factory.getAMMMAp                              |
| termStartTimestamp     | uint256 | The new AMM&#39;s term start timestamp in wei-seconds (ie the deployed block time) |
| termEndTimestamp       | uint256 | The new AMM&#39;s maturity date in wei-seconds                                     |

### OwnerChanged

```solidity
event OwnerChanged(address indexed oldOwner, address indexed newOwner)
```

Emitted when the owner of the factory is changed

#### Parameters

| Name               | Type    | Description                            |
| ------------------ | ------- | -------------------------------------- |
| oldOwner `indexed` | address | The owner before the owner was changed |
| newOwner `indexed` | address | The owner after the owner was changed  |
