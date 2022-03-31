// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../AaveFCM.sol";

contract TestAaveFCM is AaveFCM {
    function getTraderMarginInYieldBearingTokensTest(address traderAddress)
        external
        view
        returns (uint256 marginInYieldBearingTokens)
    {
        TraderWithYieldBearingAssets.Info storage trader = traders[
            traderAddress
        ];
        marginInYieldBearingTokens = getTraderMarginInYieldBearingTokens(
            trader.marginInScaledYieldBearingTokens
        );
    }

    function getVAMMAddress() external view returns (address) {
        return address(_vamm);
    }

    function getUnderlyingYieldBearingToken() external view returns (address) {
        return address(_underlyingYieldBearingToken);
    }

    function getAaveLendingPool() external view returns (address) {
        return address(_aaveLendingPool);
    }

    function estimateSettlementCashflow(
        address traderAddress,
        uint256 termStartTimestampWad,
        uint256 termEndTimestampWad,
        uint256 variableFactorWad
    ) external view returns (int256) {
        TraderWithYieldBearingAssets.Info storage trader = traders[
            traderAddress
        ];

        int256 settlementCashflow = FixedAndVariableMath
            .calculateSettlementCashflow(
                trader.fixedTokenBalance,
                trader.variableTokenBalance,
                termStartTimestampWad,
                termEndTimestampWad,
                variableFactorWad
            );

        // if settlement happens late, additional variable yield beyond maturity will accrue to the trader

        return settlementCashflow;
    }
}
