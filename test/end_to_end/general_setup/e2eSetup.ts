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
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../shared/utilities";

const Minter1 = 0;
const Minter2 = 1;
const Minter3 = 2;
const Minter4 = 3;
const Minter5 = 4;

const Swapper1 = 0;
const Swapper2 = 1;
const Swapper3 = 2;
const Swapper4 = 3;
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
      sigmaSquaredWad: toBn("0.15"),
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,
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
];
