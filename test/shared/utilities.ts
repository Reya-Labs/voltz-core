import { BigNumber, BigNumberish, utils } from "ethers";
import Bn from "bignumber.js";
import JSBI from "jsbi";
import { BigintIsh } from "./constants";
import { sqrt } from "./sqrt";
import { div, sub, mul, add } from "./functions";
import { toBn } from "evm-bn";

export const ZERO_ADDRESS: string =
  "0x0000000000000000000000000000000000000000";

export const ZERO_BYTES: string =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export const INVALID_ORACLE_ID: string =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export const TICK_SPACING: number = 60;

export const SECONDS_IN_YEAR: BigNumber = toBn("31536000");
// export const BLOCK_TIMESTAMP: number = 1632249308;
export const MaxUint128 = BigNumber.from(2).pow(128).sub(1);

export const getMinTick = (tickSpacing: number) =>
  Math.ceil(-887272 / tickSpacing) * tickSpacing;
export const getMaxTick = (tickSpacing: number) =>
  Math.floor(887272 / tickSpacing) * tickSpacing;

export const getMaxLiquidityPerTick = (tickSpacing: number) =>
  BigNumber.from(2)
    .pow(128)
    .sub(1)
    .div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1);

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0
 * @param amount1 The numerator amount i.e., the amount of token1
 * @param amount0 The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio
 */

export function encodeSqrtRatioX96(
  amount1: BigintIsh,
  amount0: BigintIsh
): JSBI {
  const numerator = JSBI.leftShift(JSBI.BigInt(amount1), JSBI.BigInt(192));
  const denominator = JSBI.BigInt(amount0);
  const ratioX192 = JSBI.divide(numerator, denominator);
  return sqrt(ratioX192);
}

export const MIN_SQRT_RATIO = BigNumber.from("4295128739");
export const MAX_SQRT_RATIO = BigNumber.from(
  "1461446703485210103287273052203988822378723970342"
);

export function expandTo18Decimals(n: number): BigNumber {
  return expandToDecimals(n, 18);
}

export function expandToDecimals(n: number, decimals: number): BigNumber {
  return BigNumber.from(n).mul(BigNumber.from(10).pow(decimals));
}

export function accrualFact(timeInSeconds: BigNumber): BigNumber {
  return div(timeInSeconds, SECONDS_IN_YEAR);
}

export function fixedFactor(
  atMaturity: boolean,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  currentBlockTimestamp: BigNumber
): BigNumber {
  let timeInSeconds: BigNumber;

  if (atMaturity || currentBlockTimestamp.gte(termEndTimestamp)) {
    timeInSeconds = sub(termEndTimestamp, termStartTimestamp);
  } else {
    timeInSeconds = sub(currentBlockTimestamp, termStartTimestamp);
  }

  const timeInYears: BigNumber = accrualFact(timeInSeconds);

  const fixedFactorValue: BigNumber = mul(timeInYears, toBn("0.01"));

  return fixedFactorValue;
}

export function getPositionKey(
  address: string,
  lowerTick: number,
  upperTick: number
): string {
  return utils.keccak256(
    utils.solidityPack(
      ["address", "int24", "int24"],
      [address, lowerTick, upperTick]
    )
  );
}

// below numbers are arbitrary for now, move into another file
export const APY_UPPER_MULTIPLIER: BigNumber = toBn("1.5"); // use Cyclop's toBn implementation
export const APY_LOWER_MULTIPLIER: BigNumber = toBn("0.7");
export const MIN_DELTA_LM: BigNumber = toBn("0.03");
export const MIN_DELTA_IM: BigNumber = toBn("0.06");
export const MAX_LEVERAGE: BigNumber = toBn("10.0");
export const SIGMA_SQUARED: BigNumber = toBn("0.01");
export const ALPHA: BigNumber = toBn("0.04");
export const BETA: BigNumber = toBn("1.0");
export const XI_UPPER: BigNumber = toBn("2.0");
export const XI_LOWER: BigNumber = toBn("1.5");
export const T_MAX: BigNumber = toBn("31536000"); // one year
export const DEFAULT_TIME_FACTOR: BigNumber = toBn("0.1");
export const MIN_TICK: number = -887272;
export const MAX_TICK: number = 887272;

export function calculateSettlementCashflow(
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestamp: BigNumber,
  termEndTimestamp: BigNumber,
  variableFactorToMaturity: BigNumber,
  currentBlockTimestamp: BigNumber
): BigNumber {
  const fixedCashflow = mul(
    fixedTokenBalance,
    fixedFactor(
      true,
      termStartTimestamp,
      termEndTimestamp,
      currentBlockTimestamp
    )
  );

  const variableCashflow = mul(variableTokenBalance, variableFactorToMaturity);

  return add(fixedCashflow, variableCashflow);
}

Bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

// returns the sqrt price as a 64x96
export function encodePriceSqrt(
  reserve1: BigNumberish,
  reserve0: BigNumberish
): BigNumber {
  return BigNumber.from(
    new Bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new Bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

// decodes the sqrt price as a floating point number
export function decodePriceSqrt(price: BigNumber): string {
  return new Bn(price.toString()).div(new Bn(2).pow(96)).pow(2).toString();
}
