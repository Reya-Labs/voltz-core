pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IRateOracle.sol";


/// @notice Common contract base for a Rate Oracle implementation.
/// @dev Each specific rate oracle implementation will need to implement the virtual functions

abstract contract BaseRateOracle is IRateOracle {

    bytes32 public immutable override rateOracleId;
    constructor(bytes32 _rateOracleId) {
        rateOracleId = _rateOracleId;
    }

    function variableFactor(bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp) public virtual override returns(uint256 result);
}