// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "hardhat/console.sol";

contract VoltzPausable is PausableUpgradeable, AccessControlUpgradeable, OwnableUpgradeable {

    bytes32 public constant VOLTZ_PAUSER = keccak256("VOLTZ_PAUSER");

    function grantPauser(address account) external onlyOwner {
        _grantRole(VOLTZ_PAUSER, account);
    }

    function revokePauser(address account) external onlyOwner {
        _revokeRole(VOLTZ_PAUSER, account);
    }

    function pause() external {
        _checkRole(VOLTZ_PAUSER, msg.sender);
        _pause();
    }

    function unpause() external {
        _checkRole(VOLTZ_PAUSER, msg.sender);
        _unpause();
    }

    // TODO: function to let those with VOLTZ_PAUSER role pause the contract - DONE
    // TODO: functions to let the Owner grant & revoke Pauser rights - DONE
    // TODO: Make all pausable contract inherit this - DONE
    // TODO: reduce contract sizes (e.g. MarginEngine) back to acceptable levels
    // TODO: write tests!
}
