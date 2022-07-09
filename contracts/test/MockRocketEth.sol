// SPDX-License-Identifier: Apache-2.0
pragma solidity =0.8.9;

import "hardhat/console.sol";

/**
 * @dev RocketPool RETH mock - only for testing purposes.
 */
contract MockRocketEth {
    uint256 private _rethMultiplier = 0;
    uint256 private _lastUpdatedBlock;
    bool private _instantUpdates;
    bool private _lastUpdatedBlockManipulation;

    constructor() public {
        _instantUpdates = true;
        _lastUpdatedBlockManipulation = false;
    }

    function setLastUpdatedBlockManipulation(bool lastUpdatedBlockManipulation) public {
        _lastUpdatedBlockManipulation = lastUpdatedBlockManipulation;
    }

    function setInstantUpdates(bool instantUpdates) public {
        _instantUpdates = instantUpdates;
    }

    function getEthValue(uint256 rethAmount) public view returns (uint256) {
        return (rethAmount * _rethMultiplier) / 1e27;
    }

    function getLastUpdatedBlock() public view returns (uint256) {
        if (_instantUpdates) {
            return block.number;
        } else {
            return _lastUpdatedBlock;
        }
    }

    function setLastUpdatedBlock(uint256 lastUpdatedBlock) public {
        require(_lastUpdatedBlockManipulation, "Enable last updated block manipulation");
        _lastUpdatedBlock = lastUpdatedBlock;
    }

    function setRethMultiplierInRay(uint256 rethMultiplier) public {
        _rethMultiplier = rethMultiplier;
        if (!_lastUpdatedBlockManipulation) {
            _lastUpdatedBlock = block.number;
        }
    }
}
