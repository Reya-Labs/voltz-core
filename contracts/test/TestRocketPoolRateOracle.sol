// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/RocketPoolRateOracle.sol";
import "./TestRateOracle.sol";

contract TestRocketPoolRateOracle is RocketPoolRateOracle, TestRateOracle {
    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(IRocketEth _rocketEth, IWETH _weth)
        RocketPoolRateOracle(
            _rocketEth,
            _weth,
            new uint32[](0),
            new uint256[](0)
        )
    {}
}
