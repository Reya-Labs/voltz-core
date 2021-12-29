// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../MarginCalculator.sol";
import "./FixedAndVariableMath.sol";

/// @title Trader
/// @notice Trader represents a holder of an active leg of an IRS position
library Trader {
    // info stored for each user's position
    struct Info {
        int256 margin;
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        bool isSettled;
    }

    function updateMargin(Info storage self, int256 marginDelta) internal {
        self.margin = self.margin + marginDelta;
    }

    function settleTrader(Info storage self) internal {
        self.isSettled = true;
    }

    function updateBalances(
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
