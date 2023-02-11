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
        IRewardRouter rewardRouter,
        IERC20Minimal underlying,
        uint32[] memory times,
        uint256[] memory rates,
        uint256 _lastEthGlpPrice,
        uint256 _lastCumulativeRewardPerToken
    )
        GlpRateOracle(
            rewardRouter,
            underlying,
            times,
            rates,
            _lastEthGlpPrice,
            _lastCumulativeRewardPerToken
        )
    {}

    function writeOracleEntry()
        external
        override(BaseRateOracle, GlpRateOracle)
    {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
        pupulateLastGlpData();
    }
}
