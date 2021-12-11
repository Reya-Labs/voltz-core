# BaseRateOracle

Common contract base for a Rate Oracle implementation.

_Each specific rate oracle implementation will need to implement the virtual functions_

## Methods

### getTwapApy

```solidity
function getTwapApy(address underlying) external view returns (uint256 twapApy)
```

#### Parameters

| Name       | Type    | Description |
| ---------- | ------- | ----------- |
| underlying | address | undefined   |

#### Returns

| Name    | Type    | Description |
| ------- | ------- | ----------- |
| twapApy | uint256 | undefined   |

### increaseObservarionCardinalityNext

```solidity
function increaseObservarionCardinalityNext(uint16 observationCardinalityNext) external nonpayable
```

#### Parameters

| Name                       | Type   | Description |
| -------------------------- | ------ | ----------- |
| observationCardinalityNext | uint16 | undefined   |

### observations

```solidity
function observations(uint256) external view returns (uint256 blockTimestamp, uint256 logApyCumulative, bool initialized)
```

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

#### Returns

| Name             | Type    | Description |
| ---------------- | ------- | ----------- |
| blockTimestamp   | uint256 | undefined   |
| logApyCumulative | uint256 | undefined   |
| initialized      | bool    | undefined   |

### oracleVars

```solidity
function oracleVars() external view returns (uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext)
```

#### Returns

| Name                       | Type   | Description |
| -------------------------- | ------ | ----------- |
| observationIndex           | uint16 | undefined   |
| observationCardinality     | uint16 | undefined   |
| observationCardinalityNext | uint16 | undefined   |

### rateOracleId

```solidity
function rateOracleId() external view returns (bytes32)
```

Gets the bytes32 ID of the rate oracle.

#### Returns

| Name | Type    | Description                                        |
| ---- | ------- | -------------------------------------------------- |
| \_0  | bytes32 | Returns the rate oracle and protocol identifier.\* |

### secondsAgo

```solidity
function secondsAgo() external view returns (uint256)
```

#### Returns

| Name | Type    | Description |
| ---- | ------- | ----------- |
| \_0  | uint256 | undefined   |

### setSecondsAgo

```solidity
function setSecondsAgo(uint256 _secondsAgo) external nonpayable
```

#### Parameters

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| \_secondsAgo | uint256 | undefined   |

### variableFactor

```solidity
function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) external nonpayable returns (uint256 result)
```

#### Parameters

| Name               | Type    | Description |
| ------------------ | ------- | ----------- |
| atMaturity         | bool    | undefined   |
| underlyingToken    | address | undefined   |
| termStartTimestamp | uint256 | undefined   |
| termEndTimestamp   | uint256 | undefined   |

#### Returns

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| result | uint256 | undefined   |

### writeOrcleEntry

```solidity
function writeOrcleEntry(address underlying) external nonpayable
```

#### Parameters

| Name       | Type    | Description |
| ---------- | ------- | ----------- |
| underlying | address | undefined   |

## Errors

### PRBMathUD60x18\_\_AddOverflow

```solidity
error PRBMathUD60x18__AddOverflow(uint256 x, uint256 y)
```

Emitted when addition overflows UD60x18.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| x    | uint256 | undefined   |
| y    | uint256 | undefined   |

### PRBMathUD60x18\_\_Exp2InputTooBig

```solidity
error PRBMathUD60x18__Exp2InputTooBig(uint256 x)
```

Emitted when the input is greater than 192.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| x    | uint256 | undefined   |

### PRBMathUD60x18\_\_LogInputTooSmall

```solidity
error PRBMathUD60x18__LogInputTooSmall(uint256 x)
```

Emitted when the input is less than 1.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| x    | uint256 | undefined   |

### PRBMathUD60x18\_\_SubUnderflow

```solidity
error PRBMathUD60x18__SubUnderflow(uint256 x, uint256 y)
```

Emitted when subtraction underflows UD60x18.

#### Parameters

| Name | Type    | Description |
| ---- | ------- | ----------- |
| x    | uint256 | undefined   |
| y    | uint256 | undefined   |

### PRBMath\_\_MulDivFixedPointOverflow

```solidity
error PRBMath__MulDivFixedPointOverflow(uint256 prod1)
```

Emitted when the result overflows uint256.

#### Parameters

| Name  | Type    | Description |
| ----- | ------- | ----------- |
| prod1 | uint256 | undefined   |

### PRBMath\_\_MulDivOverflow

```solidity
error PRBMath__MulDivOverflow(uint256 prod1, uint256 denominator)
```

Emitted when the result overflows uint256.

#### Parameters

| Name        | Type    | Description |
| ----------- | ------- | ----------- |
| prod1       | uint256 | undefined   |
| denominator | uint256 | undefined   |
