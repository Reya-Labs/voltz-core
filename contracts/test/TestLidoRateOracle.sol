// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/LidoRateOracle.sol";
import "./TestRateOracle.sol";

contract TestLidoRateOracle is LidoRateOracle, TestRateOracle {
    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(IStETH _stEth, IWETH _weth)
        LidoRateOracle(_stEth, _weth, new uint32[](0), new uint256[](0))
    {}
}
