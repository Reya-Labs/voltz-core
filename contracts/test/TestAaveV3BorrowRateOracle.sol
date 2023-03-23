// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/AaveV3BorrowRateOracle.sol";
import "../utils/WadRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/aave/IAaveV3LendingPool.sol";
import "./TestRateOracle.sol";

contract TestAaveV3BorrowRateOracle is AaveV3BorrowRateOracle, TestRateOracle {
    // using OracleBuffer for OracleBuffer.Observation[65535];

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(IAaveV3LendingPool aaveLendingPool, IERC20Minimal underlying)
        AaveV3BorrowRateOracle(
            aaveLendingPool,
            underlying,
            new uint32[](0),
            new uint256[](0)
        )
    {}
}
