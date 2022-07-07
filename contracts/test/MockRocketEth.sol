// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

/**
 * @dev RocketPool RETH mock - only for testing purposes.
 */
contract MockRocketEth {
    uint256 private rethMultiplier = 0;
    uint256 private lastUpdatedBlock;

    function getEthValue(uint256 _rethAmount) public view returns (uint256) {
        return (_rethAmount * rethMultiplier) / 1e27;
    }

    function getLastUpdatedBlock() public view returns (uint256) {
        return lastUpdatedBlock;
    }

    function setRethMultiplierInRay(uint256 _rethMultiplier) public {
        rethMultiplier = _rethMultiplier;
        lastUpdatedBlock = block.number;
    }
}
