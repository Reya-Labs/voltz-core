// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../rate_oracles/BaseRateOracle.sol";

contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {
    /// @inheritdoc IAaveRateOracle
    IAaveV2LendingPool public override aaveLendingPool;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 1; // id of aave v2 is 1

    constructor(
        IAaveV2LendingPool _aaveLendingPool,
        IERC20Minimal _underlying,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(_underlying) {
        require(
            address(_aaveLendingPool) != address(0),
            "aave pool must exist"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        aaveLendingPool = _aaveLendingPool;

        _populateInitialObservations(_times, _results, true);
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        resultRay = aaveLendingPool.getReserveNormalizedIncome(underlying);
        if (resultRay == 0) {
            revert CustomErrors.AavePoolGetReserveNormalizedIncomeReturnedZero();
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
