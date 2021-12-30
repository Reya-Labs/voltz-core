import type { BigNumber as EthersBigNumber } from "@ethersproject/bignumber";
import type { BigNumber as MathjsBigNumber } from "mathjs";
import { E } from "./constants";
import { toMbn, toEbn } from "./helpers";
import math from "./math";

// refer to https://github.com/hifi-finance/prb-math/blob/main/src/functions.ts for other math functions

export function div(x: EthersBigNumber, y: EthersBigNumber): EthersBigNumber {
  if (y.isZero()) {
    throw new Error("Cannot divide by zero");
  }
  const result: MathjsBigNumber = toMbn(x).div(toMbn(y));
  return toEbn(result);
}

export function sub(x: EthersBigNumber, y: EthersBigNumber) {
  const result: MathjsBigNumber = toMbn(x).sub(toMbn(y));
  return toEbn(result);
}

export function mul(x: EthersBigNumber, y: EthersBigNumber) {
  const result: MathjsBigNumber = toMbn(x).mul(toMbn(y));
  return toEbn(result);
}

export function add(x: EthersBigNumber, y: EthersBigNumber) {
  const result: MathjsBigNumber = toMbn(x).add(toMbn(y));
  return toEbn(result);
}

export function sqrt(x: EthersBigNumber): EthersBigNumber {
  if (x.isNegative()) {
    throw new Error("Cannot calculate the square root of a negative number");
  }
  const result = math.sqrt!(toMbn(x)) as MathjsBigNumber;
  return toEbn(result);
}

export function floor(x: EthersBigNumber): EthersBigNumber {
  const result: MathjsBigNumber = toMbn(x).floor();
  return toEbn(result);
}

export function pow(x: EthersBigNumber, y: EthersBigNumber): EthersBigNumber {
  const result: MathjsBigNumber = toMbn(x).pow(toMbn(y));
  return toEbn(result);
}

export function exp(x: EthersBigNumber): EthersBigNumber {
  return pow(E, x);
}
