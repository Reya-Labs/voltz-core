// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

contract VoltzPausable is PausableUpgradeable, OwnableUpgradeable {
    bytes32 public constant VOLTZ_PAUSER = keccak256("VOLTZ_PAUSER");

    mapping(address => bool) private pauser;

    function grantPauser(address account) external onlyOwner {
        pauser[account] = true;
    }

    function revokePauser(address account) external onlyOwner {
        pauser[account] = false;
    }

    function pause() external {
        require(pauser[msg.sender], "no pauser role");
        _pause();
    }

    function unpause() external {
        require(pauser[msg.sender], "no pauser role");
        _unpause();
    }
}
