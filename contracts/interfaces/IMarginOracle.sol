// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

interface IMarginOracle {
    function setUnderlyingPoolConfidenceBound(
        address _underlyingPool,
        address _pricer,
        bool isLower
    ) external;

    function getConfidenceBound(address _underlyingPool, bool isLower)
        external
        view
        returns (uint256 result);

    function setConfidenceBound(
        address _underlyingPool,
        uint256 _confidenceBound,
        bool isLower
    ) external;
}
