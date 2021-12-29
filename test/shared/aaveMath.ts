import { BigNumber as BigNumberJs } from "bignumber.js";

export const RAY = new BigNumberJs(10).exponentiatedBy(27).toFixed();

declare module "bignumber.js" {
  interface BigNumber {
    // eslint-disable-next-line no-unused-vars
    rayDiv: (a: BigNumber) => BigNumber;
  }
}

BigNumberJs.prototype.rayDiv = function (a: BigNumberJs): BigNumberJs {
  const halfA = a.div(2).decimalPlaces(0, BigNumberJs.ROUND_DOWN);

  return halfA
    .plus(this.multipliedBy(RAY))
    .decimalPlaces(0, BigNumberJs.ROUND_DOWN)
    .div(a)
    .decimalPlaces(0, BigNumberJs.ROUND_DOWN);
};
