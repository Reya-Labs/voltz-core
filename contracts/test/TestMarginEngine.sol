pragma solidity ^0.8.0;

import "../MarginEngine.sol";

contract TestMarginEngine is MarginEngine {
    // maybe need a different constructor
    // constructor() {
    //       // address ammAddress;
    //       // (ammAddress) = IDeployer(msg.sender).marginEngineParameters();
    //       // amm = IAMM(ammAddress);
    //       address ammAddress;
    // }

    function getUnderlyingToken()
        external
        view
        returns (address underlyingToken)
    {
        return amm.underlyingToken();
    }

    function updateTraderMarginTest(int256 marginDelta) external {
        updateTraderMargin(marginDelta);
    }

    function checkTraderMarginCanBeUpdatedTest(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isTraderSettled,
        address ammAddress // todo: redundunt?
    ) external view {    
        return checkTraderMarginCanBeUpdated(updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance, isTraderSettled, ammAddress);
    }


    function checkTraderMarginAboveRequirementTest(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        address ammAddress
    ) external view {    
        return checkTraderMarginAboveRequirement(updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance, ammAddress);
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
        uint256 variableFactor,
        address ammAddress
    ) public view {

        return checkPositionMarginCanBeUpdated(ModifyPositionParams(
            {
                owner: owner,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta
            }
        ), updatedMarginWouldBe, isPositionBurned, isPositionSettled, positionLiquidity, positionFixedTokenBalance, positionVariableTokenBalance, variableFactor, ammAddress);

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
        uint256 variableFactor,
        address ammAddress
    ) public view {

        return checkPositionMarginAboveRequirement(ModifyPositionParams(
            {
                owner: owner,
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta
            }
        ), updatedMarginWouldBe, positionLiquidity, positionFixedTokenBalance, positionVariableTokenBalance, variableFactor, ammAddress);

    }


    
}
