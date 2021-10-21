
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