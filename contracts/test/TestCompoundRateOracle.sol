pragma solidity ^0.8.0;
import "../rate_oracles/CompoundRateOracle.sol";
import "../interfaces/compound/ICToken.sol";
import "./TestRateOracle.sol";

contract TestCompoundRateOracle is TestRateOracle, CompoundRateOracle {
    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(
        ICToken cToken,
        IERC20Minimal underlying,
        uint8 _decimals
    )
        CompoundRateOracle(
            cToken,
            underlying,
            _decimals,
            new uint32[](0),
            new uint256[](0)
        )
    {}
}
