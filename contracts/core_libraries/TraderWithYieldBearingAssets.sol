// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./FixedAndVariableMath.sol";

/// @title Trader
// works for Aave
library TraderWithYieldBearingAssets {
    // info stored for each user's position
    struct Info {
        uint256 marginInUnderlyingTokens;
        uint256 marginInYieldBearingTokens; // in terms of aUSDC
        int256 fixedTokenBalance;
        int256 variableTokenBalance;
        bool isSettled;
        uint256 lastMarginUpdateBlockTimestmap;
        uint256 rateFromRayLastUpdate;
    }

    function updateMarginInUnderlyingTokensViaDelta(
        Info storage self,
        uint256 marginDelta
    ) internal {
        self.marginInUnderlyingTokens =
            self.marginInUnderlyingTokens +
            marginDelta;
    }

    function updateRateFrom(Info storage self, uint256 _rateFromRay) internal {
        self.rateFromRayLastUpdate = _rateFromRay;
    }

    function updateLastMarginUpdateBlockTimestamp(
        Info storage self,
        uint256 lastMarginUpdateBlockTimestmap
    ) internal {
        self.lastMarginUpdateBlockTimestmap = lastMarginUpdateBlockTimestmap;
    }

    function updateMarginInYieldBearingTokens(
        Info storage self,
        uint256 _marginInYieldBearingTokens
    ) internal {
        self.marginInYieldBearingTokens = _marginInYieldBearingTokens;
    }

    function settleTrader(Info storage self) internal {
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
