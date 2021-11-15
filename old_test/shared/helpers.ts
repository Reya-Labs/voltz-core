import type { BigNumber as EthersBigNumber } from "@ethersproject/bignumber";
import type { BigNumber as MathjsBigNumber } from "mathjs";
import { fromBn, toBn } from "evm-bn";
import { Decimal } from "decimal.js";
import math from "./math";
import { DECIMALS } from "./constants";

export function toEbn(
  x: MathjsBigNumber,
  rm: Decimal.Rounding = Decimal.ROUND_DOWN
): EthersBigNumber {
  const fixed = x.toFixed(Number(DECIMALS), rm);
  return toBn(fixed, Number(DECIMALS));
}

export function toMbn(x: EthersBigNumber): MathjsBigNumber {
  return math.bignumber!(fromBn(x, Number(DECIMALS)));
}
