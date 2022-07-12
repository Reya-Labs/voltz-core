import { BigNumber } from "@ethersproject/bignumber";
import { toBn } from "evm-bn";
import JSBI from "jsbi";
import { consts } from "../../helpers/constants";
import { TickMath } from "../../shared/tickMath";
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

export interface e2eParametersGeneral {
  duration: BigNumber;
  lookBackWindowAPY: BigNumber;

  numActors: number;

  marginCalculatorParams: any;

  startingPrice: JSBI;
  tickSpacing: number;

  feeProtocol: number;
  fee: BigNumber;

  positions: [number, number, number][]; // list of [index of actor, lower tick, upper tick]

  isWETH?: boolean;

  noMintTokens?: boolean;

  rateOracle: number;
}
