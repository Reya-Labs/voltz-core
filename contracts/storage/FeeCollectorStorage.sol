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
    // todo: figure out the slots amount
    uint256[69] private __gap; // total storage = 100 slots, including structs
}
