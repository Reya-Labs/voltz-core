// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

interface IFeeCollector {
    // Events
    event FeeDistributed(
        address asset,
        uint256 defaultFundsDelta,
        uint256 protocolFeesDelta
    );
    event FeeCollected(
        address asset,
        bool fromDefaultFund,
        uint256 collectedAmount
    );
    event DefaultFundPaused(bool _defaultFundPaused);

    // immutables

    /// @notice Allocated the contract's balance to the default fund and the protocol fees
    /// @dev Funds are allocated as such: 50% to default fund (if the fund is not paused) and the rest to protocol fees
    /// @param asset Token address of interest
    /// @return defaultFundsDelta delta amount added to the default fund
    /// @return protocolFeesDelta delta amounts added to the protocol fee fund
    function distributeFees(address asset)
        external
        returns (uint256 defaultFundsDelta, uint256 protocolFeesDelta);

    /// @notice Allocated the entire contract's balance in spefied assets to the default fund and the protocol fees
    function distributeAllFees(address[] memory assets) external;

    /// @notice Transfers the specified amount in given asset to the owner
    /// @param asset Token address of asset that is transferred
    /// @param amount Amount to be sent to owner
    /// @param fromDefaultFund Flags the source of the funds
    /// @return defaultFundsDelta delta amount subtracted from the default fund
    /// @return protocolFeesDelta delta amounts subtracted from the protocol fee fund
    function collectFees(
        address asset,
        uint256 amount,
        bool fromDefaultFund
    ) external returns (uint256 defaultFundsDelta, uint256 protocolFeesDelta);

    /// @notice Transfers the entire fund balance in the given assets to owner
    function collectAllFees(address[] memory assets, bool fromDefaultFund)
        external;

    /// @notice Pauses/Restarts the accumulation of default funds
    function setDefaultFundPaused(bool _defaultFundPaused) external;

    /// @dev "constructor" for proxy instances
    function initialize() external;

    // non-view functions

    /// @notice Returns the total value of the default fund
    /// @param asset Token address of interest
    function getDefaultFund(address asset) external view returns (uint256);

    /// @notice Returns the total value of protocol fees
    /// @param asset Token address of interest
    function getProtocolFees(address asset) external view returns (uint256);
}
