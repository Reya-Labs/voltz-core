import type { BigNumber as EthersBigNumber } from "@ethersproject/bignumber";
import type { BigNumber as MathjsBigNumber } from "mathjs";
import { toMbn, toEbn } from "./helpers";

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
