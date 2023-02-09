// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/BaseRateOracle.sol";
import "../rate_oracles/OracleBuffer.sol";
import "../rate_oracles/GlpRateOracle.sol";
import "../interfaces/rate_oracles/IGlpRateOracle.sol";
import "../utils/WadRayMath.sol";
import "hardhat/console.sol";
import "../interfaces/glp/IRewardRouter.sol";
import "./TestRateOracle.sol";

contract TestGlpRateOracle is GlpRateOracle, TestRateOracle {
    // using OracleBuffer for OracleBuffer.Observation[65535];

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(
        IRewardRouter aaveLendingPool,
        IERC20Minimal underlying,
        uint32[] memory times,
        uint256[] memory rates
    ) GlpRateOracle(aaveLendingPool, underlying, times, rates) {}
}
