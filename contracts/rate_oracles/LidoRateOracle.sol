// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../interfaces/rate_oracles/ILidoRateOracle.sol";
import "../interfaces/lido/IStETH.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "../utils/WadRayMath.sol";

contract LidoRateOracle is BaseRateOracle, ILidoRateOracle {
    IStETH public override stEth;

    uint8 public constant override UNDERLYING_YIELD_BEARING_PROTOCOL_ID = 3; // id of Lido is 3

    constructor(
        IStETH _stEth,
        uint32[] memory _times,
        uint256[] memory _results
    ) BaseRateOracle(IERC20Minimal(address(0))) {
        // Underlying is ETH, so no address needed
        require(address(_stEth) != address(0), "stETH must exist");
        stEth = _stEth;

        _populateInitialObservations(_times, _results);
    }

    /// @inheritdoc BaseRateOracle
    /// @dev To get a Lido value in Ray, we query the value (in ETH/WETH) of 1e27 Lido shares
    function getCurrentRateInRay()
        public
        view
        override
        returns (uint256 resultRay)
    {
        // We are taking advantage of the fact that Lido's implementation does not care about us passing in a
        // number of shares that is higher than the number of shared in existence.
        // The calculation that Lido does here would risk phantom overflow if Lido had > 10^50 ETH WEI staked
        // But that amount of ETH will never exist, so this is safe
        resultRay = stEth.getPooledEthByShares(WadRayMath.RAY);
        if (resultRay == 0) {
            revert CustomErrors.LidoGetPooledEthBySharesReturnedZero();
        }
        return resultRay;
    }
}
