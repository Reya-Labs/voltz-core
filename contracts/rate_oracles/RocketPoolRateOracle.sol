// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/IRocketPoolRateOracle.sol";
import "../interfaces/rocketPool/IRocketEth.sol";
import "../interfaces/rocketPool/IRocketNetworkBalances.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "../utils/WadRayMath.sol";

contract RocketPoolRateOracle is BaseRateOracle, IRocketPoolRateOracle {
    IRocketEth public override rocketEth;
    IRocketNetworkBalances public override rocketNetworkBalances;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 4; // id of RocketPool is 4

    constructor(
        IRocketEth _rocketEth,
        IRocketNetworkBalances _rocketNetworkBalances,
        IWETH _weth,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(IERC20Minimal(address(_weth))) {
        // Underlying is ETH, so no address needed
        require(address(_rocketEth) != address(0), "RETH must exist");
        rocketEth = _rocketEth;

        require(
            address(_rocketNetworkBalances) != address(0),
            "RNB must exist"
        );
        rocketNetworkBalances = _rocketNetworkBalances;

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
        // TODO: derive from getLastUpdatedRate() and extraopolate from recent rates if necessary.
        // This function can move into BaseRateOracle and there should be no need to override it for specific oracles.
    }

    /// @inheritdoc BaseRateOracle
    function getLastUpdatedRate()
        public
        view
        override
        returns (uint32 timestamp, uint256 resultRay)
    {
        resultRay = rocketEth.getEthValue(WadRayMath.RAY);
        if (resultRay == 0) {
            revert CustomErrors.RocketPoolGetEthValueReturnedZero();
        }

        // TODO: need to change this due to the approximation of block
        uint256 lastUpdatedBlock = rocketNetworkBalances.getBalancesBlock();
        uint256 lastUpdatedTimestamp = block.timestamp -
            (block.number - lastUpdatedBlock) *
            15;

        return (Time.timestampAsUint32(lastUpdatedTimestamp), resultRay);
    }
}
