// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/interfaces/lido/IStETH.sol";

/**
 * @dev StETH mock - only for testing purposes.
 */
contract MockStEth is IStETH {
    uint256 private _sharesMultiplier = 0;
    uint256 private _lastUpdatedTimestamp;
    bool private _instantUpdates;
    bool private _lastUpdatedTimestampManipulation;

    constructor() public {
        _instantUpdates = true;
        _lastUpdatedTimestampManipulation = false;
    }

    function setLastUpdatedTimestampManipulation(bool lastUpdatedTimestampManipulation)
        public
    {
        _lastUpdatedTimestampManipulation = lastUpdatedTimestampManipulation;
    }

    function getPooledEthByShares(uint256 sharesAmount)
        public
        view
        returns (uint256)
    {
        return (sharesAmount * _sharesMultiplier) / 1e27;
    }

    function setInstantUpdates(bool instantUpdates) public {
        _instantUpdates = instantUpdates;
    }

    function getInstantUpdates() public view returns (bool) {
        return _instantUpdates;
    }

    function getlastUpdatedTimestamp() public view returns (uint256) {
        return _lastUpdatedTimestamp;
    }

    function setSharesMultiplierInRay(uint256 sharesMultiplier) public {
        _sharesMultiplier = sharesMultiplier;
        _lastUpdatedTimestamp = block.timestamp;
    }

    function setLastUpdatedTimestamp(uint256 lastUpdatedTimestamp) public {
        require(
            _lastUpdatedTimestampManipulation,
            "Enable last updated block manipulation"
        );
        _lastUpdatedTimestamp = lastUpdatedTimestamp;
    }

    /**
     * @notice Returns staking rewards fee rate
     */
    function getFee() external view override returns (uint16 feeBasisPoints) {
        return 1000;
    }
}
