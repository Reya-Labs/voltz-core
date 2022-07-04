// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "contracts/interfaces/lido/IStETH.sol";

/**
 * @dev StETH mock - only for testing purposes.
 */
contract MockStEth is IStETH {
    uint256 private sharesMultiplier = 1e27;

    function getPooledEthByShares(uint256 _sharesAmount)
        public
        view
        returns (uint256)
    {
        return (_sharesAmount * sharesMultiplier) / 1e27;
    }

    function setSharesMultiplierInRay(uint256 _sharesMultiplier) public {
        sharesMultiplier = _sharesMultiplier;
    }

    /**
     * @notice Returns staking rewards fee rate
     */
    function getFee() external view override returns (uint16 feeBasisPoints) {
        return 1000;
    }
}
