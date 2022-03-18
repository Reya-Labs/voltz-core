// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./IERC20Minimal.sol";

interface IERC20Extended is IERC20Minimal {
    /// @notice Gets the address of the cToken
    /// @return Address of the cToken
    function ctoken() external view returns (address);
}
