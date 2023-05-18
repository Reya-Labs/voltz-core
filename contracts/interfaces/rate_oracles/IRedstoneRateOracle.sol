// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "../redstone/IPriceFeed.sol";
import "../rate_oracles/IRateOracle.sol";

interface IRedstoneRateOracle is IRateOracle {
    /// @notice Gets the address of the Price Feed
    /// @return Address of the Price Feed
    function priceFeed() external view returns (IPriceFeed);
}