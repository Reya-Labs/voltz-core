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
        int256 unbalancedFixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) public {
        position.updateBalancesViaDeltas(
            fixedTokenBalanceDelta,
            unbalancedFixedTokenBalanceDelta,
            variableTokenBalanceDelta
        );
    }

    function calculateFixedAndVariableDelta(
        int256 fixedTokenGrowthInside,
        int256 unbalancedFixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    )
        public
        view
        returns (
            int256 _fixedTokenBalance,
            int256 _unbalancedFixedTokenBalance,
            int256 _variableTokenBalance
        )
    {
        (
            _fixedTokenBalance,
            _unbalancedFixedTokenBalance,
            _variableTokenBalance
        ) = position.calculateFixedAndVariableDelta(
            fixedTokenGrowthInside,
            unbalancedFixedTokenGrowthInside,
            variableTokenGrowthInside
        );
    }

    function updateFixedAndVariableTokenGrowthInside(
        int256 fixedTokenGrowthInside,
        int256 unbalancedFixedTokenGrowthInside,
        int256 variableTokenGrowthInside
    ) public {
        position.updateFixedAndVariableTokenGrowthInside(
            fixedTokenGrowthInside,
            unbalancedFixedTokenGrowthInside,
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
