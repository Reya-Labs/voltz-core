// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract VoltzPausable is PausableUpgradeable, AccessControlUpgradeable, OwnableUpgradeable {

    bytes32 public constant VOLTZ_PAUSER = keccak256("VOLTZ_PAUSER");

    function initialize() external initializer {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(VOLTZ_PAUSER, msg.sender);
        __Pausable_init();
        __Ownable_init();
    }

    // TODO: function to let those with VOLTZ_PAUSER role pause the contract
    // TODO: functions to let the Owner grant & revoke Pauser rights
    // TODO: Make all pausable contract inherit this
    // TODO: reduce contract sizes (e.g. MarginEngine) back to aceptable levels
    // TODO: write tests!

    // https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}
}
