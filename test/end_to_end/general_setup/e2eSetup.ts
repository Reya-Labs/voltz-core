import { BigNumber } from "@ethersproject/bignumber";
import { toBn } from "evm-bn";
import JSBI from "jsbi";
import { consts } from "../../helpers/constants";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../shared/utilities";

export interface e2eParameters {
  duration: BigNumber;
  lookBackWindowAPY: BigNumber;

  numActors: number;

  marginCalculatorParams: any;

  startingPrice: JSBI;
  tickSpacing: number;

  feeProtocol: number;
  fee: BigNumber;

  positions: [number, number, number][]; // list of [index of actor, lower tick, upper tick]
}

export const e2eScenarios: e2eParameters[] = [
  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 4,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 0,
    fee: toBn("0"),
    tickSpacing: TICK_SPACING,
    positions: [
      [0, -TICK_SPACING, TICK_SPACING],
      [1, -3 * TICK_SPACING, -TICK_SPACING],
      [2, -TICK_SPACING, TICK_SPACING],
      [3, -TICK_SPACING, TICK_SPACING],
    ],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 5,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 2,
    fee: toBn("0.5"),
    tickSpacing: TICK_SPACING,
    positions: [
      [0, -TICK_SPACING, 0],
      [1, -TICK_SPACING, 0],
      [2, -TICK_SPACING, 0],
      [3, -TICK_SPACING, 0],
      [4, -TICK_SPACING, 0],
    ],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 4,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 0,
    fee: toBn("0"),
    tickSpacing: TICK_SPACING,
    positions: [
      [0, -TICK_SPACING * 300, -TICK_SPACING * 299],
      [1, -TICK_SPACING * 300, -TICK_SPACING * 299],
      [2, -TICK_SPACING, TICK_SPACING],
      [3, -TICK_SPACING, TICK_SPACING],
    ],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 4,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 2,
    fee: toBn("0.5"),
    tickSpacing: TICK_SPACING,
    positions: [
      [0, -TICK_SPACING, TICK_SPACING],
      [1, -3 * TICK_SPACING, -TICK_SPACING],
      [2, -TICK_SPACING, TICK_SPACING],
      [3, -TICK_SPACING, TICK_SPACING],
    ],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 6,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 2,
    fee: toBn("0.5"),
    tickSpacing: TICK_SPACING,
    positions: [
      [0, -TICK_SPACING, TICK_SPACING],
      [1, -3 * TICK_SPACING, -TICK_SPACING],
      [0, -3 * TICK_SPACING, TICK_SPACING],
      [0, 0, TICK_SPACING],
      [2, -3 * TICK_SPACING, TICK_SPACING],
      [3, -TICK_SPACING, TICK_SPACING],
      [4, -TICK_SPACING, TICK_SPACING],
      [5, -TICK_SPACING, TICK_SPACING]
    ],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numActors: 6,
    marginCalculatorParams: {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      devMulLeftUnwindLMWad: toBn("0.5"),
      devMulRightUnwindLMWad: toBn("0.5"),
      devMulLeftUnwindIMWad: toBn("0.8"),
      devMulRightUnwindIMWad: toBn("0.8"),

      fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
      fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

      fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
      fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    },
    lookBackWindowAPY: consts.ONE_WEEK,
    startingPrice: encodeSqrtRatioX96(1, 1),
    feeProtocol: 2,
    fee: toBn("0.5"),
    tickSpacing: TICK_SPACING,
    positions: Array(100).fill(0).map((_, index) => [0, -(index+1)*TICK_SPACING, (index+1)*TICK_SPACING]),
  },
];
