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
}

// contract TestMarginEngine is MarginEngine {
//     using Position for mapping(bytes32 => Position.Info);
//     using Position for Position.Info;

//     function getUnderlyingToken()
//         external
//         pure
//         returns (address underlyingToken)
//     {
//         return underlyingToken;
//     }

//     function checkPositionMarginCanBeUpdatedTest(
//         address owner,
//         int24 tickLower,
//         int24 tickUpper,
//         int128 liquidityDelta,
//         int256 updatedMarginWouldBe,
//         bool isPositionBurned,
//         bool isPositionSettled,
//         uint128 positionLiquidity,
//         int256 positionFixedTokenBalance,
//         int256 positionVariableTokenBalance,
//         uint256 variableFactor
//     ) public {
//         return
//             checkPositionMarginCanBeUpdated(
//                 ModifyPositionParams({
//                     owner: owner,
//                     tickLower: tickLower,
//                     tickUpper: tickUpper,
//                     liquidityDelta: liquidityDelta
//                 }),
//                 updatedMarginWouldBe,
//                 isPositionBurned,
//                 isPositionSettled,
//                 positionLiquidity,
//                 positionFixedTokenBalance,
//                 positionVariableTokenBalance,
//                 variableFactor
//             );
//     }

//     function checkPositionMarginAboveRequirementTest(
//         address owner,
//         int24 tickLower,
//         int24 tickUpper,
//         int128 liquidityDelta,
//         int256 updatedMarginWouldBe,
//         uint128 positionLiquidity,
//         int256 positionFixedTokenBalance,
//         int256 positionVariableTokenBalance,
//         uint256 variableFactor
//     ) public {
//         return
//             checkPositionMarginAboveRequirement(
//                 ModifyPositionParams({
//                     owner: owner,
//                     tickLower: tickLower,
//                     tickUpper: tickUpper,
//                     liquidityDelta: liquidityDelta
//                 }),
//                 updatedMarginWouldBe,
//                 positionLiquidity,
//                 positionFixedTokenBalance,
//                 positionVariableTokenBalance,
//                 variableFactor
//             );
//     }

//     function updatePositionTokenBalancesAndAccountForFeesTest(
//         address owner,
//         int24 tickLower,
//         int24 tickUpper
//     ) external {
//         updatePositionTokenBalancesAndAccountForFees(
//             owner,
//             tickLower,
//             tickUpper
//         );
//     }

//     function setPosition(
//         address owner,
//         int24 tickLower,
//         int24 tickUpper,
//         uint128 _liquidity,
//         int256 margin,
//         int256 fixedTokenGrowthInsideLastX128,
//         int256 variableTokenGrowthInsideLastX128,
//         int256 fixedTokenBalance,
//         int256 variableTokenBalance,
//         uint256 feeGrowthInsideLastX128,
//         bool isSettled
//     ) external {
//         positions[
//             keccak256(abi.encodePacked(owner, tickLower, tickUpper))
//         ] = Position.Info({
//             _liquidity: _liquidity,
//             margin: margin,
//             fixedTokenGrowthInsideLastX128: fixedTokenGrowthInsideLastX128,
//             variableTokenGrowthInsideLastX128: variableTokenGrowthInsideLastX128,
//             fixedTokenBalance: fixedTokenBalance,
//             variableTokenBalance: variableTokenBalance,
//             feeGrowthInsideLastX128: feeGrowthInsideLastX128,
//             isSettled: isSettled
//         });
//     }

//     function unwindPositionTest(
//         address owner,
//         int24 tickLower,
//         int24 tickUpper
//     ) public {
//         unwindPosition(owner, tickLower, tickUpper);
//     }

//     function getCachedHistoricalApy() external view returns (uint256) {
//         return cachedHistoricalApy;
//     }
// }
