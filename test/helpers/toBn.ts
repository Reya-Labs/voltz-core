import { toBn as stringToBn } from "evm-bn";
import { BigNumber } from "ethers";

/**
 * Convert a possibly-stringified fixed-point number to a big number with a custom number of decimals.
 *
 * @remarks
 * - Accepts scientific notation.
 * - Checks are in place to adhere to the numerical constraints of the EVM.
 */
export function toBn(
  x: string | number,
  decimals: number | undefined = undefined
): BigNumber {
  if (typeof x !== "string") {
    return stringToBn(x.toString(), decimals);
  } else {
    return stringToBn(x, decimals);
  }
}
