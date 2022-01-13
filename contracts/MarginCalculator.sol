// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./utils/TickMath.sol";
import "./utils/SqrtPriceMath.sol";
import "./interfaces/IMarginCalculator.sol";
import "./core_libraries/FixedAndVariableMath.sol";
import "./core_libraries/Position.sol";
import "hardhat/console.sol";
import "./core_libraries/Tick.sol";
import "./interfaces/IFactory.sol";

/// @title Margin Calculator
/// @notice Margin Calculator Performs the calculations necessary to establish Margin Requirements on Voltz Protocol
contract MarginCalculator is IMarginCalculator {
  int256 public constant ONE_WEI = 10**18;

  /// @dev Must be the Factory owner
  error NotFactoryOwner();

  
  address public immutable override factory;

  modifier onlyFactoryOwner() {
    if (msg.sender != IFactory(factory).owner()) {
      revert NotFactoryOwner();
    }
    _;
  }

  constructor(address _factory) {
    factory = _factory;
  }

  mapping(address => MarginCalculatorParameters)
    internal getMarginCalculatorParameters;

  /// @dev Seconds in a year
  int256 public constant SECONDS_IN_YEAR = 31536000 * ONE_WEI;

  /// @notice Set the per-oracle MarginCalculatorParameters
  /// @param marginCalculatorParameters the MarginCalculatorParameters to set
  function setMarginCalculatorParameters(
    MarginCalculatorParameters memory marginCalculatorParameters,
    address rateOracleAddress
  ) public override onlyFactoryOwner {
    getMarginCalculatorParameters[rateOracleAddress] = marginCalculatorParameters;
  }

  /// @dev In the litepaper the timeFactor is exp(-beta*(t-s)/t_max) where t is the maturity timestamp, and t_max is the max number of seconds for the amm duration, s is the current timestamp and beta is a diffusion process parameter set via calibration
  function computeTimeFactor(
    address rateOracleAddress,
    uint256 termEndTimestampScaled,
    uint256 currentTimestampScaled
  ) internal view returns (int256 timeFactor) {
    require(termEndTimestampScaled > 0, "termEndTimestamp must be > 0");
    require(
      currentTimestampScaled <= termEndTimestampScaled,
      "endTime must be > currentTime"
    );
    require(
      getMarginCalculatorParameters[rateOracleAddress].beta != 0,
      "parameters not set for oracle"
    );

    int256 beta = getMarginCalculatorParameters[rateOracleAddress].beta;
    int256 tMax = getMarginCalculatorParameters[rateOracleAddress].tMax;

    int256 scaledTime = PRBMathSD59x18.div(
      (int256(termEndTimestampScaled) - int256(currentTimestampScaled)),
      tMax
    );

    int256 expInput = PRBMathSD59x18.mul((-beta), scaledTime);

    timeFactor = PRBMathSD59x18.exp(expInput);
  }

  /// @notice Calculates an APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
  /// @param rateOracleAddress A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
  /// @param termEndTimestampScaled termEndTimestampScaled
  /// @param currentTimestampScaled currentTimestampScaled
  /// @param historicalApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
  /// @param isUpper isUpper = true ==> calculating the APY Upper Bound, otherwise APY Lower Bound
  /// @return apyBound APY Upper or Lower Bound of a given underlying pool (e.g. Aave v2 USDC Lending Pool)
  function computeApyBound(
    address rateOracleAddress,
    uint256 termEndTimestampScaled,
    uint256 currentTimestampScaled,
    uint256 historicalApy,
    bool isUpper
  ) internal view returns (uint256 apyBound) {
    ApyBoundVars memory apyBoundVars;

    int256 beta4 = PRBMathSD59x18.mul(
      getMarginCalculatorParameters[rateOracleAddress].beta,
      4 * ONE_WEI
    );

    apyBoundVars.timeFactor = computeTimeFactor(
      rateOracleAddress,
      termEndTimestampScaled,
      currentTimestampScaled
    );

    apyBoundVars.oneMinusTimeFactor = ONE_WEI - apyBoundVars.timeFactor;

    apyBoundVars.k = PRBMathSD59x18.div(
      getMarginCalculatorParameters[rateOracleAddress].alpha,
      getMarginCalculatorParameters[rateOracleAddress].sigmaSquared
    );

    apyBoundVars.zeta = PRBMathSD59x18.div(
      PRBMathSD59x18.mul(
        getMarginCalculatorParameters[rateOracleAddress].sigmaSquared,
        apyBoundVars.oneMinusTimeFactor
      ),
      beta4
    );

    apyBoundVars.lambdaNum = PRBMathSD59x18.mul(
      PRBMathSD59x18.mul(
        beta4,
        apyBoundVars.timeFactor
      ),
      int256(historicalApy)
    );

    apyBoundVars.lambdaDen = PRBMathSD59x18.mul(
      beta4,
      apyBoundVars.timeFactor
    ); // check the time factor exists, if not have a fallback?
    apyBoundVars.lambda = PRBMathSD59x18.div(
      apyBoundVars.lambdaNum,
      apyBoundVars.lambdaDen
    );

    apyBoundVars.criticalValueMultiplier = PRBMathSD59x18.mul(
      PRBMathSD59x18.mul(2 * (10**18), apyBoundVars.lambda) + apyBoundVars.k,
      (2 * (10**18))
    );

    apyBoundVars.criticalValue;

    if (isUpper) {
      apyBoundVars.criticalValue = PRBMathSD59x18.mul(
        getMarginCalculatorParameters[rateOracleAddress].xiUpper,
        PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplier)
      );
    } else {
      apyBoundVars.criticalValue = PRBMathSD59x18.mul(
        getMarginCalculatorParameters[rateOracleAddress].xiLower,
        PRBMathSD59x18.sqrt(apyBoundVars.criticalValueMultiplier)
      );
    }

    int256 apyBoundInt = PRBMathSD59x18.mul(
      apyBoundVars.zeta,
      apyBoundVars.k + apyBoundVars.lambda + apyBoundVars.criticalValue
    );

    if (apyBoundInt < 0) {
      apyBound = 0;
    } else {
      apyBound = uint256(apyBoundInt);
    }
  }

  /// @notice Calculates the Worst Case Variable Factor At Maturity
  /// @param timeInSecondsFromStartToMaturity Duration of a given IRS AMM (18 decimals)
  /// @param termEndTimestampScaled termEndTimestampScaled
  /// @param currentTimestampScaled currentTimestampScaled
  /// @param isFT isFT => we are dealing with a Fixed Taker (short) IRS position, otherwise it is a Variable Taker (long) IRS position
  /// @param isLM isLM => we are computing a Liquidation Margin otherwise computing an Initial Margin
  /// @param rateOracleAddress A bytes32 string which is a unique identifier for each rateOracle (e.g. AaveV2)
  /// @param historicalApy Geometric Mean Time Weighted Average APY (TWAPPY) of the underlying pool (e.g. Aave v2 USDC Lending Pool)
  /// @return variableFactor The Worst Case Variable Factor At Maturity = APY Bound * accrualFactor(timeInYearsFromStartUntilMaturity) where APY Bound = APY Upper Bound for Fixed Takers and APY Lower Bound for Variable Takers
  function worstCaseVariableFactorAtMaturity(
    uint256 timeInSecondsFromStartToMaturity,
    uint256 termEndTimestampScaled,
    uint256 currentTimestampScaled,
    bool isFT,
    bool isLM,
    address rateOracleAddress,
    uint256 historicalApy
  ) internal view returns (uint256 variableFactor) {
    uint256 timeInYearsFromStartUntilMaturity = FixedAndVariableMath
      .accrualFact(timeInSecondsFromStartToMaturity);

    if (isFT) {
      if (isLM) {
        variableFactor = PRBMathUD60x18.mul(
          computeApyBound(
            rateOracleAddress,
            termEndTimestampScaled,
            currentTimestampScaled,
            historicalApy,
            true
          ),
          timeInYearsFromStartUntilMaturity
        );
      } else {
        variableFactor = PRBMathUD60x18.mul(
          PRBMathUD60x18.mul(
            computeApyBound(
              rateOracleAddress,
              termEndTimestampScaled,
              currentTimestampScaled,
              historicalApy,
              true
            ),
            getMarginCalculatorParameters[rateOracleAddress].apyUpperMultiplier
          ),
          timeInYearsFromStartUntilMaturity
        );
      }
    } else {
      if (isLM) {
        variableFactor = PRBMathUD60x18.mul(
          computeApyBound(
            rateOracleAddress,
            termEndTimestampScaled,
            currentTimestampScaled,
            historicalApy,
            false
          ),
          timeInYearsFromStartUntilMaturity
        );
      } else {
        variableFactor = PRBMathUD60x18.mul(
          PRBMathUD60x18.mul(
            computeApyBound(
              rateOracleAddress,
              termEndTimestampScaled,
              currentTimestampScaled,
              historicalApy,
              false
            ),
            getMarginCalculatorParameters[rateOracleAddress].apyLowerMultiplier
          ),
          timeInYearsFromStartUntilMaturity
        );
      }
    }
  }

  /// @inheritdoc IMarginCalculator
  function getMinimumMarginRequirement(
    TraderMarginRequirementParams memory params
  ) public view override returns (uint256 margin) {
    MinimumMarginRequirementLocalVars memory vars;

    vars.timeInSeconds = params.termEndTimestamp - params.termStartTimestamp;

    vars.timeInYears = FixedAndVariableMath.accrualFact(vars.timeInSeconds);

    if (params.isLM) {
      vars.minDelta = uint256(
        getMarginCalculatorParameters[params.rateOracleAddress].minDeltaLM
      );
    } else {
      vars.minDelta = uint256(
        getMarginCalculatorParameters[params.rateOracleAddress].minDeltaIM
      );
    }

    if (params.variableTokenBalance < 0) {
      // variable token balance must be negative
      vars.notional = uint256(-params.variableTokenBalance);

      margin = PRBMathUD60x18.mul(
        vars.notional,
        PRBMathUD60x18.mul(vars.minDelta, vars.timeInYears)
      );
    } else {
      // variable token balance must be non-negative
      // fixed token balance must be non-positive
      // check that at least one is non-zero

      vars.notional = uint256(params.variableTokenBalance);

      vars.zeroLowerBoundMargin = PRBMathUD60x18.mul(
        uint256(-params.fixedTokenBalance),
        FixedAndVariableMath.fixedFactor(
          true,
          params.termStartTimestamp,
          params.termEndTimestamp
        )
      );

      margin = PRBMathUD60x18.mul(
        vars.notional,
        PRBMathUD60x18.mul(vars.minDelta, vars.timeInYears)
      );

      if (margin > vars.zeroLowerBoundMargin) {
        margin = vars.zeroLowerBoundMargin;
      }

      // console.log(
      //   "Contract: The fixed factor is",
      //   FixedAndVariableMath.fixedFactor(
      //     true,
      //     params.termStartTimestamp,
      //     params.termEndTimestamp
      //   )
      // );
      // console.log("Contract: The time in years is", vars.timeInYears);
      // console.log("Contract: The notional is", vars.notional);
      // console.log("Contract: The margin is", margin);
    }
  }

  /// @inheritdoc IMarginCalculator
  function getTraderMarginRequirement(
    TraderMarginRequirementParams memory params
  ) public view override returns (uint256 margin) {
    if (params.fixedTokenBalance >= 0 && params.variableTokenBalance >= 0) {
      return 0;
    }

    uint256 timeInSecondsFromStartToMaturity = params.termEndTimestamp -
      params.termStartTimestamp;

    int256 exp1 = PRBMathSD59x18.mul(
      params.fixedTokenBalance,
      int256(
        FixedAndVariableMath.fixedFactor(
          true,
          params.termStartTimestamp,
          params.termEndTimestamp
        )
      )
    );

    int256 exp2 = PRBMathSD59x18.mul(
      params.variableTokenBalance,
      int256(
        worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturity,
          params.termEndTimestamp,
          Time.blockTimestampScaled(),
          params.variableTokenBalance < 0,
          params.isLM,
          params.rateOracleAddress,
          params.historicalApy
        )
      )
    );

    int256 modelMargin = exp1 + exp2;

    int256 minimumMargin = int256(getMinimumMarginRequirement(params));
    if (modelMargin < minimumMargin) {
      margin = uint256(minimumMargin);
    } else {
      margin = uint256(modelMargin);
    }
  }

  /// @notice Calculates the margin requirement for an LP whose position is in a tick range that bounds the current tick in the vAMM
  /// @param params Values necessary for the purposes of the computation of the Position Margin Requirement
  /// @dev vars Intermediate Values necessary for the purposes of the computation of the Position Margin Requirement
  /// @return margin Either Liquidation or Initial Margin Requirement of a given position in terms of the underlying tokens
  function positionMarginBetweenTicksHelper(
    PositionMarginRequirementParams memory params
  ) internal view returns (uint256 margin) {
    PositionMarginRequirementsVars memory vars;

    // going up balance delta --> the trader is giving up variable and is receiving fixed (the trader is a Fixed Taker)
    // causes the prices to go up, implied fixed rates to go down
    // hence amount0Up should be positive and amount1Up should be negative for the trader
    // however, we are interested in the LP's who take the opposite side, so for them
    // amount0Up must be negative and amount1Up should be positive

    require(params.currentTick < params.tickUpper, "currentTick<tickUpper");
    require(params.currentTick >= params.tickLower, "currentTick >= tickLower");

    // make sure the signs below are correct
    vars.amount0Up = SqrtPriceMath.getAmount0Delta(
      TickMath.getSqrtRatioAtTick(params.currentTick),
      TickMath.getSqrtRatioAtTick(params.tickUpper),
      -int128(params.liquidity)
    ); // should be negative

    vars.amount1Up = SqrtPriceMath.getAmount1Delta(
      TickMath.getSqrtRatioAtTick(params.currentTick),
      TickMath.getSqrtRatioAtTick(params.tickUpper),
      int128(params.liquidity)
    ); // should be positive

    assert(vars.amount0Up <= 0);
    assert(vars.amount1Up >= 0);

    vars.expectedVariableTokenBalanceAfterUp =
      params.variableTokenBalance +
      vars.amount1Up;

    vars.expectedFixedTokenBalanceAfterUp =
      params.fixedTokenBalance +
      FixedAndVariableMath.getFixedTokenBalance(
        vars.amount0Up,
        vars.amount1Up,
        params.variableFactor,
        params.termStartTimestamp,
        params.termEndTimestamp
      );

    uint256 marginReqAfterUp = getTraderMarginRequirement(
      TraderMarginRequirementParams({
        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterUp,
        variableTokenBalance: vars.expectedVariableTokenBalanceAfterUp,
        termStartTimestamp: params.termStartTimestamp,
        termEndTimestamp: params.termEndTimestamp,
        isLM: params.isLM,
        rateOracleAddress: params.rateOracleAddress,
        historicalApy: params.historicalApy
      })
    );

    // going down balance delta --> the trader is giving up fixed and is receiving variable (the trader is a Variable Taker)
    // causes the prices to go down, implied fixed rates to go up
    // hence amount0Down must be negative and amount1Up should be positve for the trader
    // however, we are interested in calculating the margin requirement for the LPs who take the opposite side
    // hence, for LPs the amount0Down must be positive and amount1Down should be negative

    vars.amount0Down = SqrtPriceMath.getAmount0Delta(
      TickMath.getSqrtRatioAtTick(params.currentTick),
      TickMath.getSqrtRatioAtTick(params.tickLower),
      int128(params.liquidity)
    );

    vars.amount1Down = SqrtPriceMath.getAmount1Delta(
      TickMath.getSqrtRatioAtTick(params.currentTick),
      TickMath.getSqrtRatioAtTick(params.tickLower),
      -int128(params.liquidity)
    );

    assert(vars.amount0Down >= 0);
    assert(vars.amount1Down <= 0);

    vars.expectedVariableTokenBalanceAfterDown =
      params.variableTokenBalance +
      vars.amount1Down;

    vars.expectedFixedTokenBalanceAfterDown =
      params.fixedTokenBalance +
      FixedAndVariableMath.getFixedTokenBalance(
        vars.amount0Down,
        vars.amount1Down,
        params.variableFactor,
        params.termStartTimestamp,
        params.termEndTimestamp
      );

    vars.marginReqAfterDown = getTraderMarginRequirement(
      TraderMarginRequirementParams({
        fixedTokenBalance: vars.expectedFixedTokenBalanceAfterDown,
        variableTokenBalance: vars.expectedVariableTokenBalanceAfterDown,
        termStartTimestamp: params.termStartTimestamp,
        termEndTimestamp: params.termEndTimestamp,
        isLM: params.isLM,
        rateOracleAddress: params.rateOracleAddress,
        historicalApy: params.historicalApy
      })
    );

    if (vars.marginReqAfterUp > vars.marginReqAfterDown) {
      margin = marginReqAfterUp;
    } else {
      margin = vars.marginReqAfterDown;
    }
  }

  /// @inheritdoc IMarginCalculator
  function isLiquidatablePosition(
    PositionMarginRequirementParams memory params,
    int256 currentMargin
  ) public view override returns (bool _isLiquidatable) {
    uint256 marginRequirement = getPositionMarginRequirement(params);
    if (currentMargin < int256(marginRequirement)) {
      _isLiquidatable = true;
    } else {
      _isLiquidatable = false;
    }
  }

  /// @inheritdoc IMarginCalculator
  function isLiquidatableTrader(
    TraderMarginRequirementParams memory params,
    int256 currentMargin
  ) public view override returns (bool isLiquidatable) {
    uint256 marginRequirement = getTraderMarginRequirement(params);

    if (currentMargin < int256(marginRequirement)) {
      isLiquidatable = true;
    } else {
      isLiquidatable = false;
    }
  }

  /// @inheritdoc IMarginCalculator
  function getPositionMarginRequirement(
    PositionMarginRequirementParams memory params
  ) public view override returns (uint256 margin) {
    if (params.liquidity == 0) {
      return 0;
    }

    PositionMarginRequirementsVars memory vars;

    // make sure amount values have correct signs

    if (params.currentTick < params.tickLower) {
      if (params.variableTokenBalance > 0) {
        revert("variable balance > 0"); // this should not be possible
      } else if (params.variableTokenBalance < 0) {
        // means the trader deposited on the other side of the tick range
        // the margin just covers the current balances of the position

        margin = getTraderMarginRequirement(
          TraderMarginRequirementParams({
            fixedTokenBalance: params.fixedTokenBalance,
            variableTokenBalance: params.variableTokenBalance,
            termStartTimestamp: params.termStartTimestamp,
            termEndTimestamp: params.termEndTimestamp,
            isLM: params.isLM,
            rateOracleAddress: params.rateOracleAddress,
            historicalApy: params.historicalApy
          })
        );
      } else {
        // the variable token balance is 0

        vars.amount0 = SqrtPriceMath.getAmount0Delta(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          -int128(params.liquidity)
        );

        vars.amount1 = SqrtPriceMath.getAmount1Delta(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          int128(params.liquidity)
        );

        vars.expectedVariableTokenBalance = vars.amount1;
        vars.expectedFixedTokenBalance = FixedAndVariableMath
          .getFixedTokenBalance(
            vars.amount0,
            vars.amount1,
            params.variableFactor,
            params.termStartTimestamp,
            params.termEndTimestamp
          );

        margin = getTraderMarginRequirement(
          TraderMarginRequirementParams({
            fixedTokenBalance: vars.expectedFixedTokenBalance,
            variableTokenBalance: vars.expectedVariableTokenBalance,
            termStartTimestamp: params.termStartTimestamp,
            termEndTimestamp: params.termEndTimestamp,
            isLM: params.isLM,
            rateOracleAddress: params.rateOracleAddress,
            historicalApy: params.historicalApy
          })
        );
      }
    } else if (params.currentTick < params.tickUpper) {
      margin = positionMarginBetweenTicksHelper(params);
    } else {
      if (params.variableTokenBalance < 0) {
        revert("variable balance < 0"); // this should not be possible
      } else if (params.variableTokenBalance > 0) {
        // means the trader deposited on the other side of the tick range
        // the margin just covers the current balances of the position

        margin = getTraderMarginRequirement(
          TraderMarginRequirementParams({
            fixedTokenBalance: params.fixedTokenBalance,
            variableTokenBalance: params.variableTokenBalance,
            termStartTimestamp: params.termStartTimestamp,
            termEndTimestamp: params.termEndTimestamp,
            isLM: params.isLM,
            rateOracleAddress: params.rateOracleAddress,
            historicalApy: params.historicalApy
          })
        );
      } else {
        // the variable token balance is 0

        vars.amount0 = SqrtPriceMath.getAmount0Delta(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          int128(params.liquidity)
        );

        vars.amount1 = SqrtPriceMath.getAmount1Delta(
          TickMath.getSqrtRatioAtTick(params.tickLower),
          TickMath.getSqrtRatioAtTick(params.tickUpper),
          -int128(params.liquidity)
        );

        vars.expectedVariableTokenBalance = vars.amount1;
        vars.expectedFixedTokenBalance = FixedAndVariableMath
          .getFixedTokenBalance(
            vars.amount0,
            vars.amount1,
            params.variableFactor,
            params.termStartTimestamp,
            params.termEndTimestamp
          );

        margin = getTraderMarginRequirement(
          TraderMarginRequirementParams({
            fixedTokenBalance: vars.expectedFixedTokenBalance,
            variableTokenBalance: vars.expectedVariableTokenBalance,
            termStartTimestamp: params.termStartTimestamp,
            termEndTimestamp: params.termEndTimestamp,
            isLM: params.isLM,
            rateOracleAddress: params.rateOracleAddress,
            historicalApy: params.historicalApy
          })
        );
      }
    }
  }
}
