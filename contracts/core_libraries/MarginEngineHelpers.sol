// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IAMM.sol";
import "../interfaces/IMarginEngine.sol";
import "./Time.sol";

contract MarginEngineHelpers {
    /// @dev Cannot have less margin than the minimum requirement
    error MarginLessThanMinimum();

    /// @dev Trader's margin cannot be updated unless the trader is settled
    error TraderNotSettled();

    /// @dev We can't withdraw more margin than we have
    error WithdrawalExceedsCurrentMargin();

    /// @dev Position must be burned after AMM has reached maturity
    error PositionNotBurned();

    /// @dev Position must be settled after AMM has reached maturity
    error PositionNotSettled();

    /// @notice Calculate the liquidator reward and the updated trader margin
    /// @param traderMargin Current margin of the trader
    /// @return liquidatorReward Liquidator Reward as a proportion of the traderMargin
    /// @return updatedMargin Trader margin net the liquidatorReward
    /// @dev liquidatorReward = traderMargin * liquidatorReward
    /// @dev updatedMargin = traderMargin - liquidatorReward
    function calculateLiquidatorRewardAndUpdatedMargin(
        int256 traderMargin,
        uint256 liquidatorRewardAsProportionOfMargin
    ) public pure returns (uint256 liquidatorReward, int256 updatedMargin) {
        liquidatorReward = PRBMathUD60x18.mul(
            uint256(traderMargin),
            liquidatorRewardAsProportionOfMargin
        );

        updatedMargin = traderMargin - int256(liquidatorReward);
    }

    /// @notice Check if the position margin is above the Initial Margin Requirement
    /// @dev Reverts if position's margin is below the requirement
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactor Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev multiplied by (time in seconds since IRS AMM inception / number of seconds in a year)
    function checkPositionMarginAboveRequirement(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor,
        address ammAddress
    ) internal {
        IAMM amm = IAMM(ammAddress);

        (, int24 tick, ) = amm.vamm().slot0();

        IMarginCalculator.PositionMarginRequirementParams
            memory marginReqParams = IMarginCalculator
                .PositionMarginRequirementParams({
                    owner: params.owner,
                    tickLower: params.tickLower,
                    tickUpper: params.tickUpper,
                    isLM: false,
                    currentTick: tick,
                    termStartTimestamp: amm.termStartTimestamp(),
                    termEndTimestamp: amm.termEndTimestamp(),
                    liquidity: positionLiquidity,
                    fixedTokenBalance: positionFixedTokenBalance,
                    variableTokenBalance: positionVariableTokenBalance,
                    variableFactor: variableFactor,
                    rateOracleId: amm.rateOracleId(),
                    historicalApy: amm.rateOracle().getHistoricalApy()
                });

        int256 positionMarginRequirement = int256(
            amm.calculator().getPositionMarginRequirement(marginReqParams)
        );

        if (updatedMarginWouldBe <= positionMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }

    /// @notice Check if the trader margin is above the Initial Margin Requirement
    /// @dev Reverts if trader's margin is below the requirement
    /// @param updatedMarginWouldBe Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    /// @param isTraderSettled Is the Trader settled, i.e. has the trader settled their IRS cashflows post IRS AMM maturity
    /// @dev Trader's margin cannot be updated unless the trader is settled
    /// @dev If the current block timestamp is higher than the term end timestamp of the IRS AMM then the trader needs to be settled to be able to update their margin
    /// @dev If the AMM has already expired and the trader is settled then the trader can withdraw their margin
    function checkTraderMarginCanBeUpdated(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        bool isTraderSettled,
        address ammAddress
    ) public {
        IAMM amm = IAMM(ammAddress);

        if (Time.blockTimestampScaled() >= amm.termEndTimestamp()) {
            if (!isTraderSettled) {
                revert TraderNotSettled();
            }
            if (updatedMarginWouldBe < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        } else {
            checkTraderMarginAboveRequirement(
                updatedMarginWouldBe,
                fixedTokenBalance,
                variableTokenBalance,
                ammAddress
            );
        }
    }

    /// @notice Check if the position margin can be updated
    /// @param params Position owner, position tickLower, position tickUpper, _
    /// @param updatedMarginWouldBe Amount of margin supporting the position following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param isPositionBurned The precise definition of a burn position is a position which has zero active liquidity in the vAMM and has settled the IRS cashflows post AMM maturity
    /// @param positionLiquidity Current liquidity supplied by the position
    /// @param positionFixedTokenBalance Fixed token balance of a position since the last mint/burn/poke
    /// @param positionVariableTokenBalance Variable token balance of a position since the last mint/burn/poke
    /// @param variableFactor Accrued Variable Factor, i.e. the variable APY of the underlying yield-bearing pool since the inception of the IRS AMM until now
    /// @dev If the current timestamp is higher than the maturity timestamp of the AMM, then the position needs to be burned (detailed definition above)
    function checkPositionMarginCanBeUpdated(
        IMarginEngine.ModifyPositionParams memory params,
        int256 updatedMarginWouldBe,
        bool isPositionBurned,
        bool isPositionSettled,
        uint128 positionLiquidity,
        int256 positionFixedTokenBalance,
        int256 positionVariableTokenBalance,
        uint256 variableFactor,
        address ammAddress
    ) public {
        IAMM amm = IAMM(ammAddress);

        /// @dev If the AMM has reached maturity, the only reason why someone would want to update
        // their margin is to withdraw it completely. If so, the position needs to be both burned
        // and settled.

        if (Time.blockTimestampScaled() >= amm.termEndTimestamp()) {
            if (!isPositionBurned) {
                revert PositionNotBurned();
            }
            if (!isPositionSettled) {
                revert PositionNotSettled();
            }
            if (updatedMarginWouldBe < 0) {
                revert WithdrawalExceedsCurrentMargin();
            }
        }

        checkPositionMarginAboveRequirement(
            params,
            updatedMarginWouldBe,
            positionLiquidity,
            positionFixedTokenBalance,
            positionVariableTokenBalance,
            variableFactor,
            ammAddress
        );
    }

    /// @notice Check if the trader margin is above the Initial Margin Requirement
    /// @dev Reverts if trader's margin is below the requirement
    /// @param updatedMarginWouldBe Amount of margin supporting the trader following a margin update if the transaction does not get reverted (e.g. if the margin requirement is not satisfied)
    /// @param fixedTokenBalance Current fixed token balance of a trader
    /// @param variableTokenBalance Current variable token balance of a trader
    function checkTraderMarginAboveRequirement(
        int256 updatedMarginWouldBe,
        int256 fixedTokenBalance,
        int256 variableTokenBalance,
        address ammAddress
    ) internal {
        IAMM amm = IAMM(ammAddress);

        int256 traderMarginRequirement = int256(
            amm.calculator().getTraderMarginRequirement(
                IMarginCalculator.TraderMarginRequirementParams({
                    fixedTokenBalance: fixedTokenBalance,
                    variableTokenBalance: variableTokenBalance,
                    termStartTimestamp: amm.termStartTimestamp(),
                    termEndTimestamp: amm.termEndTimestamp(),
                    isLM: false,
                    rateOracleId: amm.rateOracleId(),
                    historicalApy: amm.rateOracle().getHistoricalApy()
                })
            )
        );

        if (updatedMarginWouldBe <= traderMarginRequirement) {
            revert MarginLessThanMinimum();
        }
    }
}
