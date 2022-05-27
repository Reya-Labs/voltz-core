// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "hardhat/console.sol";

contract VoltzPausable is OwnableUpgradeable {
    bytes32 public constant VOLTZ_PAUSER = keccak256("VOLTZ_PAUSER");

    mapping(address => bool) private pauser;
    bool public paused;

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    function changePauser(address account, bool permission) external onlyOwner {
        pauser[account] = permission;
    }

    function setPausability(bool state) external {
        require(pauser[msg.sender], "no role");
        paused = state;
    }
}
