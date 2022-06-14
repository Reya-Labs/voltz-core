// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

/**
 * @dev StETH mock - only for testing purposes.
 */
contract MockStEth {
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
}
