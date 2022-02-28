// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./FixedAndVariableMath.sol";

/// @title Trader
// todo: split this lib into aave only and common functionalities
library TraderWithYieldBearingAssets {
    // info stored for each user's position
    struct Info {
        // For Aave v2 The scaled balance is the sum of all the
        // updated stored balance divided by the reserve's liquidity index at the moment of the update
        uint256 marginInScaledYieldBearingTokens;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        bool isSettled;
    }

    function updateMarginInScaledYieldBearingTokens(
        Info storage self,
        uint256 _marginInScaledYieldBearingTokens
    ) internal {
        self
            .marginInScaledYieldBearingTokens = _marginInScaledYieldBearingTokens;
    }

    function settleTrader(Info storage self) internal {
        require(!self.isSettled, "already settled");
        self.isSettled = true;
    }

    function updateBalancesViaDeltas(
        Info storage self,
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) internal {
        Info memory _self = self;

        int256 fixedTokenBalance = _self.fixedTokenBalance +
            fixedTokenBalanceDelta;

        int256 variableTokenBalance = _self.variableTokenBalance +
            variableTokenBalanceDelta;

        self.fixedTokenBalance = fixedTokenBalance;
        self.variableTokenBalance = variableTokenBalance;
    }
}
