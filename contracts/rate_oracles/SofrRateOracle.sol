// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ISofrRateOracle.sol";
import "../interfaces/redstone/IPriceFeed.sol";
import "../rate_oracles/BaseRateOracle.sol";

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

import "../utils/SafeCastUni.sol";

import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WadRayMath.sol";

contract SofrRateOracle is BaseRateOracle, ISofrRateOracle {
    uint256 public constant SOFR_RAY_RATIO = 1e19;

    /// @inheritdoc ISofrRateOracle
    IPriceFeed public override sofrIndexValue;
    /// @inheritdoc ISofrRateOracle
    IPriceFeed public override sofrIndexEffectiveDate;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 10;

    using PRBMathUD60x18 for uint256;

    using SafeCastUni for int256;

    uint256 public constant SECONDS_IN_360DAY_YEAR_IN_WAD = 31104000e18;

    constructor(
        IPriceFeed _sofrIndexValue,
        IPriceFeed _sofrIndexEffectiveDate,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(_underlying) {
        require(
            address(_sofrIndexValue) != address(0),
            "sofr index value contract must exist"
        );
        require(
            address(_sofrIndexEffectiveDate) != address(0),
            "sofr index effective date contract must exist"
        );

        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");

        sofrIndexValue = _sofrIndexValue;
        sofrIndexEffectiveDate = _sofrIndexEffectiveDate;

        require(sofrIndexValue.decimals() == 8, "8 decimals");

        _populateInitialObservations(_times, _results, true);
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        (, int256 sofrIndex, , , ) = sofrIndexValue.latestRoundData();
        (, int256 sofrIndexTimestamp, , , ) = sofrIndexEffectiveDate
            .latestRoundData();
        if (sofrIndex <= 0 || sofrIndexTimestamp <= 0) {
            revert CustomErrors.RedstoneLatestRoundDataReturnedNegativeOrZero();
        }

        uint256 sofrIndexRay = sofrIndex.toUint256() * SOFR_RAY_RATIO;
        uint32 sofrIndexTimestampUint32 = Time.timestampAsUint32(
            sofrIndexTimestamp.toUint256()
        );

        return (sofrIndexTimestampUint32, sofrIndexRay);
    }

    /// @notice Divide a given time in seconds by the number of seconds in a 360-day year
    /// @param timeInSecondsAsWad A time in seconds in Wad (i.e. scaled up by 10^18)
    /// @return timeIn360dayYearsWad An annualised factor of timeInSeconds, also in Wad (360-day year)
    function accrualFact360dayYearWad(uint256 timeInSecondsAsWad)
        internal
        pure
        returns (uint256 timeIn360dayYearsWad)
    {
        timeIn360dayYearsWad = timeInSecondsAsWad.div(
            SECONDS_IN_360DAY_YEAR_IN_WAD
        );
    }

    /// @inheritdoc BaseRateOracle
    /// @dev rateOfReturn = (rateToRay / rateFromRay) - 1
    function getRateOfReturn(uint256 rateFromRay, uint256 rateToRay)
        internal
        pure
        override
        returns (uint256 rateOfReturn)
    {
        rateOfReturn =
            WadRayMath.rayDiv(rateToRay, rateFromRay) -
            WadRayMath.RAY;
    }

    /// @inheritdoc BaseRateOracle
    /// @dev apy = rateFromTo * (360 / timeDelta)
    /// @dev apy = rateFromTo / [(timeDelta / 365) * (365 / 360)]
    /// @dev apy = rateFromTo / [timeInYears * (365 / 360)]
    function computeApyFromRate(uint256 rateFromToWad, uint256 timeInYearsWad)
        internal
        pure
        override
        returns (uint256 apyWad)
    {
        // convert time in calendar years to time in 360-day year
        uint256 timeIn360dayYearsWad = accrualFact360dayYearWad(
            timeInYearsWad.mul(FixedAndVariableMath.SECONDS_IN_YEAR_IN_WAD)
        );

        apyWad = rateFromToWad.div(timeIn360dayYearsWad);
    }

    /// @inheritdoc BaseRateOracle
    /// @dev apy = (rateValue / beforeOrAtRateValue - 1) * (360 / timeDelta)
    /// @dev rateValue = (apy * (timeDelta / 360) + 1) * beforeOrAtRateValue
    function interpolateRateValue(
        uint256 beforeOrAtRateValueRay,
        uint256 apyFromBeforeOrAtToAtOrAfterWad,
        uint256 timeDeltaBeforeOrAtToQueriedTimeWad
    ) public pure override returns (uint256 rateValueRay) {
        uint256 timeIn360DayYearsWad = accrualFact360dayYearWad(
            timeDeltaBeforeOrAtToQueriedTimeWad
        );

        uint256 factorInWad = apyFromBeforeOrAtToAtOrAfterWad.mul(
            timeIn360DayYearsWad
        ) + ONE_IN_WAD;
        uint256 factorInRay = WadRayMath.wadToRay(factorInWad);

        rateValueRay = WadRayMath.rayMul(beforeOrAtRateValueRay, factorInRay);
    }
}
