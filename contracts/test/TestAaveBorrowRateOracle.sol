// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/AaveBorrowRateOracle.sol";
import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../utils/WadRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "./TestRateOracle.sol";

contract TestAaveBorrowRateOracle is AaveBorrowRateOracle, TestRateOracle {
    // using OracleBuffer for OracleBuffer.Observation[65535];

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(IAaveV2LendingPool aaveLendingPool, IERC20Minimal underlying)
        AaveBorrowRateOracle(
            aaveLendingPool,
            underlying,
            new uint32[](0),
            new uint256[](0)
        )
    {}
}
