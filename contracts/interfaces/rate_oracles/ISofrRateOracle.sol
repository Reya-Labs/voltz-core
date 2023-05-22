// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;
import "../redstone/IPriceFeed.sol";
import "../rate_oracles/IRateOracle.sol";

interface ISofrRateOracle is IRateOracle {
    /// @notice Gets the address of the Price Feed 
    /// @notice responsible for the SOFR Index Value
    /// @return Address of the Price Feed
    function sofrIndexValue() external view returns (IPriceFeed);

    /// @notice Gets the address of the Price Feed 
    /// @notice responsible for the SOFR Index Effective Date
    /// @return Address of the Price Feed
    function sofrIndexEffectiveDate() external view returns (IPriceFeed);
}