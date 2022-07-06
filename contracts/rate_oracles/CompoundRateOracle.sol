// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ICompoundRateOracle.sol";
import "../interfaces/compound/ICToken.sol";
import "./BaseRateOracle.sol";

contract CompoundRateOracle is BaseRateOracle, ICompoundRateOracle {
    /// @inheritdoc ICompoundRateOracle
    ICToken public immutable override ctoken;

    /// @inheritdoc ICompoundRateOracle
    uint8 public immutable override decimals;

    uint256 private immutable scaleDownFactor;
    uint256 private immutable scaleUpFactor;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 2; // id of compound is 2

    // cToken exchangeRateStored() returns the current exchange rate as an unsigned integer, scaled by 1 * 10^(10 + Underlying Token Decimals)
    // source: https://compound.finance/docs/ctokens#exchange-rate and https://compound.finance/docs#protocol-math
    // We want the same number scaled by 10^27 (ray)
    // So: if Underlying Token Decimals == 17, no scaling is required
    //     if Underlying Token Decimals > 17, we scale down by a factor of 10^difference
    //     if Underlying Token Decimals < 17, we scale up by a factor of 10^difference
    uint8 constant DECIMALS_SCALING_THRESHOLD = 17;

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

        // Decimals affects how the rates are encoded in compound
        scaleDownFactor = decimals >= DECIMALS_SCALING_THRESHOLD
            ? 10**(decimals - DECIMALS_SCALING_THRESHOLD)
            : 0;
        scaleUpFactor = decimals < DECIMALS_SCALING_THRESHOLD
            ? 10**(DECIMALS_SCALING_THRESHOLD - decimals)
            : 0;

        _populateInitialObservations(_times, _results);
    }

    /// @inheritdoc BaseRateOracle
    /// @dev In the case of Compound, the rates are obtained by calling ctoken.exchangeRateStored. This returned value is scaled differently for different assets, so it requires careful normalisation to ray.
    function getCurrentRateInRay()
        public
        view
        override
        returns (uint256 resultRay)
    {
        uint256 exchangeRateStored = ctoken.exchangeRateStored();
        if (exchangeRateStored == 0) {
            revert CustomErrors.CTokenExchangeRateReturnedZero();
        }

        // cToken exchangeRateStored() returns the current exchange rate as an unsigned integer, scaled by 1 * 10^(10 + Underlying Token Decimals)
        // source: https://compound.finance/docs/ctokens#exchange-rate and https://compound.finance/docs#protocol-math
        // We want the same number scaled by 10^27 (ray)
        // So: if Underlying Token Decimals == 17, no scaling is required
        //     if Underlying Token Decimals > 17, we scale down by a factor of 10^difference
        //     if Underlying Token Decimals < 17, we scale up by a factor of 10^difference
        if (decimals >= DECIMALS_SCALING_THRESHOLD) {
            resultRay = exchangeRateStored / scaleDownFactor;
        } else {
            resultRay = exchangeRateStored * scaleUpFactor;
        }

        return resultRay;
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        uint256 exchangeRateStored = ctoken.exchangeRateStored();
        if (exchangeRateStored == 0) {
            revert CustomErrors.CTokenExchangeRateReturnedZero();
        }

        // cToken exchangeRateStored() returns the current exchange rate as an unsigned integer, scaled by 1 * 10^(10 + Underlying Token Decimals)
        // source: https://compound.finance/docs/ctokens#exchange-rate and https://compound.finance/docs#protocol-math
        // We want the same number scaled by 10^27 (ray)
        // So: if Underlying Token Decimals == 17, no scaling is required
        //     if Underlying Token Decimals > 17, we scale down by a factor of 10^difference
        //     if Underlying Token Decimals < 17, we scale up by a factor of 10^difference
        if (decimals >= DECIMALS_SCALING_THRESHOLD) {
            resultRay = exchangeRateStored / scaleDownFactor;
        } else {
            resultRay = exchangeRateStored * scaleUpFactor;
        }

        return (Time.blockTimestampTruncated(), resultRay);
    }
}
