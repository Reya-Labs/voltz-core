// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ICompoundRateOracle.sol";
import "../interfaces/compound/ICToken.sol";
import "./BaseRateOracle.sol";

contract CompoundBorrowRateOracle is BaseRateOracle, ICompoundRateOracle {
    /// @inheritdoc ICompoundRateOracle
    ICToken public immutable override ctoken;

    /// @inheritdoc ICompoundRateOracle
    uint8 public immutable override decimals;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 6; // id of compound is 6

    constructor(
        ICToken _ctoken,
        bool ethPool,
        IERC20Minimal underlying,
        uint8 _decimals,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(underlying) {
        ctoken = _ctoken;
        require(
            ethPool || ctoken.underlying() == address(underlying),
            "Tokens do not match"
        );
        // Check that underlying was set in BaseRateOracle
        require(address(underlying) != address(0), "underlying must exist");
        decimals = _decimals;

        _populateInitialObservations(_times, _results);
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        uint256 borrowIndexPrior = ctoken.borrowIndex();

        uint256 borrowRateMantissa = ctoken.borrowRatePerBlock();
        require(
            borrowRateMantissa <= ctoken.borrowRateMaxMantissa(),
            "borrow rate is absurdly high"
        );

        uint256 blockDelta = block.number - ctoken.accrualBlockNumber();
        uint256 simpleInterestFactor = borrowRateMantissa * blockDelta;

        uint256 borrowIndex = (simpleInterestFactor * borrowIndexPrior) /
            1e18 +
            borrowIndexPrior;

        return (Time.blockTimestampTruncated(), borrowIndex * 1e9);
    }
}
