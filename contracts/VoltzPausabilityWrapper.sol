// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

interface VAMMInterface {
    function setPausability(bool state) external;

    function paused() external view returns (bool);
}

contract VoltzPausabilityWrapper is Ownable {
    mapping (address => bool) internal pausers;

    function isPauser(address addr) external view returns(bool) {
        return pausers[addr];
    }

    function grantPermission(address to) onlyOwner external {
        require(!pausers[to], "Already pauser");

        pausers[to] = true;
    }

    function revokePermission(address to) onlyOwner external {
        require(pausers[to], "Already non-pauser");

        pausers[to] = false;
    } 

    function pauseContracts(VAMMInterface[] memory vamms) external {
        require(pausers[msg.sender], "No privilege");

        for (uint256 i = 0; i < vamms.length; i++) {
            if (!vamms[i].paused()) {
                vamms[i].setPausability(true);
            }
        }
    }

    function unpauseContracts(VAMMInterface[] memory vamms) external {
        require(pausers[msg.sender], "No privilege");

        for (uint256 i = 0; i < vamms.length; i++) {
            if (vamms[i].paused()) {
                vamms[i].setPausability(false);
            }
        }
    }
}