// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// needs to be refactored for the new setup

import "../MarginEngine.sol";
import "../core_libraries/Position.sol";

contract TestMarginEngine is MarginEngine {

    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    function updatePositionTokenBalancesAndAccountForFeesTest(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external {

        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        updatePositionTokenBalancesAndAccountForFees(
            position,
            tickLower,
            tickUpper
        );
    }

    function getUnderlyingToken()
        external
        pure
        returns (address underlyingToken)
    {
        return underlyingToken;
    }

    function checkPositionMarginCanBeUpdatedTest(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        uint128 counterfactualLiquidity,
        int256 counterfactualFixedTokenBalance,
        int256 counterfactualVariableTokenBalance,
        int256 counterfactualMargin
    ) public {
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        position._liquidity = counterfactualLiquidity;
        position.fixedTokenBalance = counterfactualFixedTokenBalance;
        position.variableTokenBalance = counterfactualVariableTokenBalance;
        position.margin = counterfactualMargin;

        return
            checkPositionMarginCanBeUpdated(
                position,
                tickLower,
                tickUpper
            );
    }

    function checkPositionMarginAboveRequirementTest(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        uint128 counterfactualLiquidity,
        int256 counterfactualFixedTokenBalance,
        int256 counterfactualVariableTokenBalance,
        int256 counterfactualMargin
    ) public {
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);

        position._liquidity = counterfactualLiquidity;
        position.fixedTokenBalance = counterfactualFixedTokenBalance;
        position.variableTokenBalance = counterfactualVariableTokenBalance;
        position.margin = counterfactualMargin;

        return
            checkPositionMarginAboveRequirement(
                position,
                tickLower,
                tickUpper
            );
    }

    function setPosition(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        uint128 _liquidity,
        int256 margin,
        int256 fixedTokenGrowthInsideLastX128,
        int256 variableTokenGrowthInsideLastX128,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        uint256 feeGrowthInsideLastX128,
        bool isSettled
    ) external {
        positions[
            keccak256(abi.encodePacked(owner, tickLower, tickUpper))
        ] = Position.Info({
            _liquidity: _liquidity,
            margin: margin,
            fixedTokenGrowthInsideLastX128: fixedTokenGrowthInsideLastX128,
            variableTokenGrowthInsideLastX128: variableTokenGrowthInsideLastX128,
            fixedTokenBalance: fixedTokenBalance,
            variableTokenBalance: variableTokenBalance,
            feeGrowthInsideLastX128: feeGrowthInsideLastX128,
            isSettled: isSettled
        });
    }

    function unwindPositionTest(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) public {
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        unwindPosition(position, owner, tickLower, tickUpper);
    }

    function getCachedHistoricalApy() external view returns (uint256) {
        return cachedHistoricalApy;
    }

    function getPositionMarginRequirementTest(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        bool isLM
    ) external returns (uint256) {
        Position.Info storage position = positions.get(owner, tickLower, tickUpper);
        return getPositionMarginRequirement(position, tickLower, tickUpper, isLM);
    }
}