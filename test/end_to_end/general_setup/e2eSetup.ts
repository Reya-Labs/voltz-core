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

// eslint-disable-next-line no-unused-vars
const Minter1 = 0;
// eslint-disable-next-line no-unused-vars
const Minter2 = 1;
// eslint-disable-next-line no-unused-vars
const Minter3 = 2;
// eslint-disable-next-line no-unused-vars
const Minter4 = 3;
// eslint-disable-next-line no-unused-vars
const Minter5 = 4;

// eslint-disable-next-line no-unused-vars
const Swapper1 = 0;
// eslint-disable-next-line no-unused-vars
const Swapper2 = 1;
// eslint-disable-next-line no-unused-vars
const Swapper3 = 2;
// eslint-disable-next-line no-unused-vars
const Swapper4 = 3;
// eslint-disable-next-line no-unused-vars
const Swapper5 = 4;

export interface MintAction {
  index: number; // index of position
  liquidity: BigNumber; // liquidity to mint (in wad)
}

export interface BurnAction {
  index: number; // index of position
  liquidity: BigNumber; // liquidity to burn (in wad)
}

export interface UpdatePositionMarginAction {
  index: number; // index of position
  margin: BigNumber; // margin to add
}

export interface UpdateTraderMarginAction {
  index: number; // index of swapper
  margin: BigNumber; // margin to add
}

export interface SwapAction {
  index: number; // index of swapper
  isFT: boolean;
  amountSpecified: BigNumber; // number of variable tokens in wad
  sqrtPriceLimitX96: BigNumber; // limit of price
}

export interface SkipAction {
  time: BigNumber;
  blockCount: number;
  reserveNormalizedIncome: number;
}

export interface e2eParameters {
  duration: BigNumber;
  lookBackWindowAPY: BigNumber;

  numMinters: number;
  numSwappers: number;

  marginCalculatorParams: any;

  startingPrice: JSBI;
  tickSpacing: number;

  feeProtocol: number;
  fee: BigNumber;

  positions: [number, number, number][]; // list of [index of minter, lower tick, upper tick]
  traders: number[]; // list of index of swapper

  actions: (
    | SkipAction
    | SwapAction
    | UpdateTraderMarginAction
    | UpdatePositionMarginAction
    | BurnAction
    | MintAction
  )[];
}

export const e2eScenarios: e2eParameters[] = [
  {
    duration: consts.ONE_MONTH.mul(3),
    numMinters: 2,
    numSwappers: 2,
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
      [Minter1, -TICK_SPACING, TICK_SPACING],
      [Minter2, -3 * TICK_SPACING, -TICK_SPACING],
    ],
    traders: [Swapper1, Swapper2],
    actions: [],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numMinters: 5,
    numSwappers: 5,
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
      [Minter1, -TICK_SPACING, 0],
      [Minter2, -TICK_SPACING, 0],
      [Minter3, -TICK_SPACING, 0],
      [Minter4, -TICK_SPACING, 0],
      [Minter5, -TICK_SPACING, 0],
    ],
    traders: [Swapper1, Swapper2, Swapper3, Swapper4, Swapper5],
    actions: [],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numMinters: 2,
    numSwappers: 2,
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
      [Minter1, -TICK_SPACING * 300, -TICK_SPACING * 299],
      [Minter2, -TICK_SPACING * 300, -TICK_SPACING * 299],
    ],
    traders: [Swapper1, Swapper2],
    actions: [],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numMinters: 2,
    numSwappers: 2,
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
    fee: toBn("0.5"),
    tickSpacing: TICK_SPACING,
    positions: [
      [Minter1, -TICK_SPACING, TICK_SPACING],
      [Minter2, -3 * TICK_SPACING, -TICK_SPACING],
    ],
    traders: [Swapper1, Swapper2],
    actions: [],
  },

  {
    duration: consts.ONE_MONTH.mul(3),
    numMinters: 3,
    numSwappers: 3,
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
      [Minter1, -TICK_SPACING, TICK_SPACING],
      [Minter2, -3 * TICK_SPACING, -TICK_SPACING],
      [Minter1, -3 * TICK_SPACING, TICK_SPACING],
      [Minter1, 0, TICK_SPACING],
      [Minter3, -3 * TICK_SPACING, TICK_SPACING],
    ],
    traders: [Swapper1, Swapper2, Swapper3],
    actions: [],
  },
];
