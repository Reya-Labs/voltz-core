// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
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

    // Events
    event MarginViaDeltaUpdate(
        Trader.Info info,
        int256 marginDelta,
        marginDelta margin
    );
    event SettleTrader(Trader.Info info);
    event BalancesViaDeltasUpdate(
        Trader.Info info,
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    );

    function updateMarginViaDelta(Info storage self, int256 marginDelta)
        internal
    {
        self.margin = self.margin + marginDelta;
        emit MarginViaDeltaUpdate(self, marginDelta, self.margin);
    }

    function settleTrader(Info storage self) internal {
        self.isSettled = true;
        emit SettleTrader(self);
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
        emit BalancesViaDeltasUpdate(
            self,
            fixedTokenBalanceDelta,
            variableTokenBalanceDelta
        );
    }
}
