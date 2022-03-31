// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;
import "../core_libraries/Position.sol";

contract PositionTest {
    Position.Info public position;
    using Position for Position.Info;

    function updateLiquidity(int128 liquidityDelta) public {
        position.updateLiquidity(liquidityDelta);
    }

    function updateMargin(int256 marginDelta) public {
        position.updateMarginViaDelta(marginDelta);
    }

    function updateBalances(
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) public {
        position.updateBalancesViaDeltas(
            fixedTokenBalanceDelta,
            variableTokenBalanceDelta
        );
    }

    function calculateFixedAndVariableDelta(
        int256 fixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    )
        public
        view
        returns (int256 _fixedTokenBalance, int256 _variableTokenBalance)
    {
        (_fixedTokenBalance, _variableTokenBalance) = position
            .calculateFixedAndVariableDelta(
                fixedTokenGrowthInside,
                variableTokenGrowthInside
            );
    }

    function updateFixedAndVariableTokenGrowthInside(
        int256 fixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    ) public {
        position.updateFixedAndVariableTokenGrowthInside(
            fixedTokenGrowthInside,
            variableTokenGrowthInside
        );
    }

    function updateFeeGrowthInside(uint256 feeGrowthInside) public {
        position.updateFeeGrowthInside(feeGrowthInside);
    }

    function calculateFeeDelta(uint256 feeGrowthInside)
        public
        view
        returns (uint256 feeDelta)
    {
        return position.calculateFeeDelta(feeGrowthInside);
    }
}
