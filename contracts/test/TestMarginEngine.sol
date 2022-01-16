pragma solidity ^0.8.0;

import "../MarginEngine.sol";
import "../core_libraries/Position.sol";
import "../core_libraries/Trader.sol";

contract TestMarginEngine is MarginEngine {
    using Position for mapping(bytes32 => Position.Info);
    using Position for Position.Info;

    function getUnderlyingToken()
        external
        pure
        returns (address underlyingToken)
    {
        return underlyingToken;
    }

    // function updateTraderMarginTest(address traderAddress, int256 marginDelta) external {
    //     updateTraderMargin(traderAddress, marginDelta);
    // }

    function checkTraderMarginCanBeUpdatedTest(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isTraderSettled
    ) external view {
        return
            checkTraderMarginCanBeUpdated(
                updatedMarginWouldBe,
                fixedTokenBalance,
                variableTokenBalance,
                isTraderSettled
            );
    }

    function checkTraderMarginAboveRequirementTest(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance
    ) external view {
        return
            checkTraderMarginAboveRequirement(
                updatedMarginWouldBe,
                fixedTokenBalance,
                variableTokenBalance
            );
    }

    function checkPositionMarginCanBeUpdatedTest(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        int128 liquidityDelta,
        int256 updatedMarginWouldBe,
        bool isPositionBurned,
        bool isPositionSettled,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor
    ) public view {
        return
            checkPositionMarginCanBeUpdated(
                ModifyPositionParams({
                    owner: owner,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: liquidityDelta
                }),
                updatedMarginWouldBe,
                isPositionBurned,
                isPositionSettled,
                positionLiquidity,
                positionFixedTokenBalance,
                positionVariableTokenBalance,
                variableFactor
            );
    }

    function checkPositionMarginAboveRequirementTest(
        address owner,
        int24 tickLower,
        int24 tickUpper,
        int128 liquidityDelta,
        int256 updatedMarginWouldBe,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor
    ) public view {
        return
            checkPositionMarginAboveRequirement(
                ModifyPositionParams({
                    owner: owner,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    liquidityDelta: liquidityDelta
                }),
                updatedMarginWouldBe,
                positionLiquidity,
                positionFixedTokenBalance,
                positionVariableTokenBalance,
                variableFactor
            );
    }

    function updatePositionTokenBalancesTest(
        address owner,
        int24 tickLower,
        int24 tickUpper
    ) external {
        updatePositionTokenBalances(owner, tickLower, tickUpper);
    }

    function setTrader(
        address traderAddress,
        int256 margin,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isSettled
    ) external {
        traders[traderAddress] = Trader.Info({
            margin: margin,
            fixedTokenBalance: fixedTokenBalance,
            variableTokenBalance: variableTokenBalance,
            isSettled: isSettled
        });
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

    // temporary until fixed
    function getHistoricalApy() public pure override returns (uint256) {
        return 10**17;
    }
}
