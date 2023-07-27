// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

contract FeeCollectorStorageV1 {
    // Any variables that would implicitly implement an IMarginEngine function if public, must instead
    // be internal due to limitations in the solidity compiler (as of 0.8.12)
    mapping(address => uint256) internal defaultFund;
    mapping(address => uint256) internal protocolFees;
    bool internal defaultFundPaused;
}

contract FeeCollectorStorage is FeeCollectorStorageV1 {
    // Reserve some storage for use in future versions, without creating conflicts
    // with other inheritted contracts
    uint256[47] private __gap; // total storage = 50 slots, including structs
}
