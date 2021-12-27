// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "../interfaces/IVAMM.sol";
import "./FixedAndVariableMath.sol";
import "../utils/TickMath.sol";

library VAMMHelpers {


  function checksBeforeSwap(IVAMM.SwapParams memory params, IVAMM.Slot0 memory slot0Start, bool isAMMLocked) external {
    // require(params.amountSpecified != 0, "AS");
    if (params.amountSpecified == 0) {
      revert IVAMM.IRSNotionalAmountSpecifiedMustBeNonZero(params.amountSpecified);
    }

    // require(amm.unlocked(), "LOK");
    // if (!amm.unlocked()) {
    if (isAMMLocked) {
      revert IVAMM.CanOnlyTradeIfUnlocked(!isAMMLocked);
    }

    require(
      params.isFT
        ? params.sqrtPriceLimitX96 > slot0Start.sqrtPriceX96 &&
          params.sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO
        : params.sqrtPriceLimitX96 < slot0Start.sqrtPriceX96 &&
          params.sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO,
      "SPL"
    );

  }

  function calculateUpdatedGlobalTrackerValues(
    IVAMM.SwapParams memory params,
    IVAMM.SwapState memory state,
    IVAMM.StepComputations memory step,
    uint256 variableFactor,
    uint256 termStartTimestamp,
    uint256 termEndTimestamp
  )
    external
    view
    returns (
      uint256 stateFeeGrowthGlobal,
      int256 stateVariableTokenGrowthGlobal,
      int256 stateFixedTokenGrowthGlobal
    )
  {
    stateFeeGrowthGlobal = state.feeGrowthGlobal + PRBMathUD60x18.div(step.feeAmount, uint256(state.liquidity));

    if (params.isFT) {
      stateVariableTokenGrowthGlobal =  state.variableTokenGrowthGlobal + PRBMathSD59x18.div(int256(step.amountOut), int256(uint256(state.liquidity)));

      // check the signs
      stateFixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal + 
          PRBMathSD59x18.div(
              FixedAndVariableMath.getFixedTokenBalance(
                -int256(step.amountIn),
                int256(step.amountOut),
                variableFactor,
                termStartTimestamp,
                termEndTimestamp
              ),
            int256(uint256(state.liquidity))
          );
    } else {
      // check the signs are correct
      stateVariableTokenGrowthGlobal = state.variableTokenGrowthGlobal + 
          PRBMathSD59x18.div(-int256(step.amountIn), int256(uint256(state.liquidity)));

      stateFixedTokenGrowthGlobal = state.fixedTokenGrowthGlobal +
          PRBMathSD59x18.div(
            FixedAndVariableMath.getFixedTokenBalance(
                int256(step.amountOut),
                -int256(step.amountIn),
                variableFactor,
                termStartTimestamp,
                termEndTimestamp
              ), // variable factor maturity false
            int256(uint256(state.liquidity))
          );
    }
  }

}