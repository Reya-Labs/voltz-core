// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "../glp/IRewardRouter.sol";
import "../rate_oracles/IRateOracle.sol";

interface IGlpRateOracle is IRateOracle {

    /// @notice Gets the address of the GMX Reward Router
    /// @return Address of the GMX Reward Router
    function rewardRouter() external view returns (IRewardRouter);
}