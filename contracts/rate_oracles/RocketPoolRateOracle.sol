// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/IRocketPoolRateOracle.sol";
import "../interfaces/rocketPool/IRocketEth.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "../utils/WadRayMath.sol";

contract RocketPoolRateOracle is BaseRateOracle, IRocketPoolRateOracle {
    IRocketEth public override rocketEth;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 4; // id of RocketPool is 4

    constructor(
        IRocketEth _rocketEth,
        IWETH _weth,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(IERC20Minimal(address(_weth))) {
        // Underlying is ETH, so no address needed
        require(address(_rocketEth) != address(0), "RETH must exist");
        rocketEth = _rocketEth;

        _populateInitialObservations(_times, _results);
    }

    /// @inheritdoc BaseRateOracle
    /// @dev To get a RocketPool value in Ray, we query the value (in ETH/WETH) of 1e27 RocketPool shares
    function getCurrentRateInRay()
        public
        view
        override
        returns (uint256 resultRay)
    {
        // We are taking advantage of the fact that RocketPool's implementation does not care about us passing in an amount
        // of RETH that it higher than the amount of RETH in existence.
        // The calculation that RocketPool does here would risk phantom overflow if RocketPool had > 10^50 ETH WEI staked
        // But that amount of ETH will never exist, so this is safe
        resultRay = rocketEth.getEthValue(WadRayMath.RAY);
        if (resultRay == 0) {
            revert CustomErrors.RocketPoolGetEthValueReturnedZero();
        }
        return resultRay;
    }
}
