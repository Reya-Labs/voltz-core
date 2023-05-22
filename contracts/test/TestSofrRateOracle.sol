// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../rate_oracles/SofrRateOracle.sol";
import "./TestRateOracle.sol";

contract TestSofrRateOracle is SofrRateOracle {
    using PRBMathUD60x18 for uint256;

    // using OracleBuffer for OracleBuffer.Observation[65535];

    // rateOracleAddress should be a function of underlyingProtocol and underlyingToken?
    constructor(
        IPriceFeed _sofrIndexValue,
        IPriceFeed _sofrIndexEffectiveDate,
        IERC20Minimal _underlying
    )
        SofrRateOracle(
            _sofrIndexValue,
            _sofrIndexEffectiveDate,
            _underlying,
            new uint32[](0),
            new uint256[](0)
        )
    {}

    function exposedAccrualFact360dayYearWad(uint256 timeInSecondsAsWad)
        public
        pure
        returns (uint256 timeIn360dayYearsWad)
    {
        return accrualFact360dayYearWad(timeInSecondsAsWad);
    }

    function exposedGetRateOfReturn(uint256 rateFromRay, uint256 rateToRay)
        public
        pure
        returns (uint256 rateOfReturn)
    {
        return getRateOfReturn(rateFromRay, rateToRay);
    }

    function exposedComputeApyFromRate(
        uint256 rateFromToWad,
        uint256 timeInYearsWad
    ) public pure returns (uint256 apyWad) {
        return computeApyFromRate(rateFromToWad, timeInYearsWad);
    }
}
