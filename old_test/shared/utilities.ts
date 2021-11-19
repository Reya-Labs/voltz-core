import bn from "bignumber.js";
import {
  BigNumber,
  BigNumberish,
  constants,
  Contract,
  ContractTransaction,
  utils,
  Wallet,
} from "ethers";
import { TestAMMCallee } from "../../typechain/TestAMMCallee";
import { MockTimeAMM } from "../../typechain/MockTimeAMM";
import JSBI from "jsbi";
import { BigintIsh } from "./constants";
import { sqrt } from "./sqrt";

export enum FeeAmount {
  LOW = 500,
  MEDIUM = 3000,
  HIGH = 10000,
}

export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};

export function getCreate2Address(
  factoryAddress: string,
  underlyingToken: string,
  underlyingPool: string,
  termEndTimestamp: number,
  termStartTimestamp: number,
  fee: number,
  bytecode: string
): string {
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ["address", "address", "uint256", "uint256", "uint24"],
    [underlyingToken, underlyingPool, termEndTimestamp, termStartTimestamp, fee]
  );

  const create2Inputs = [
    "0xff",
    factoryAddress,
    // salt
    utils.keccak256(constructorArgumentsEncoded),
    // init code. bytecode + constructor arguments
    utils.keccak256(bytecode),
  ];
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join("")}`;
  return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`);
}

export type MintFunction = (
  recipient: string,
  tickLower: BigNumberish,
  tickUpper: BigNumberish,
  liquidity: BigNumberish
) => Promise<ContractTransaction>;

export type SwapToPriceFunction = (
  sqrtPriceX96: BigNumberish,
  to: Wallet | string
) => Promise<ContractTransaction>;

export type SwapFunction = (
  amount: BigNumberish,
  to: Wallet | string,
  sqrtPriceLimitX96?: BigNumberish
) => Promise<ContractTransaction>;

export interface AMMFunctions {
  mint: MintFunction;

  swapToLowerPrice: SwapToPriceFunction;
  swapToHigherPrice: SwapToPriceFunction;
  swapExact0For1: SwapFunction;
  swap0ForExact1: SwapFunction;
  swapExact1For0: SwapFunction;
  swap1ForExact0: SwapFunction;
}

export function createAMMFunctions({
  swapTarget,
  amm,
}: {
  swapTarget: TestAMMCallee;
  amm: MockTimeAMM;
}): AMMFunctions {
  async function swapToSqrtPrice(
    isFT: boolean,
    targetPrice: BigNumberish,
    to: Wallet | string
  ): Promise<ContractTransaction> {
    const method = isFT
      ? swapTarget.swapToHigherSqrtPrice
      : swapTarget.swapToLowerSqrtPrice;

    const toAddress = typeof to === "string" ? to : to.address;

    return method(amm.address, targetPrice, toAddress);
  }

  async function swap(
    isFT: boolean,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: Wallet | string,
    sqrtPriceLimitX96?: BigNumberish
  ): Promise<ContractTransaction> {
    const exactInput = amountOut === 0;

    // todo: make sure this is correct
    const method = isFT
      ? exactInput
        ? swapTarget.swapExact1For0
        : swapTarget.swap1ForExact0
      : exactInput
      ? swapTarget.swapExact0For1
      : swapTarget.swap0ForExact1;

    if (typeof sqrtPriceLimitX96 === "undefined") {
      if (isFT) {
        sqrtPriceLimitX96 = MAX_SQRT_RATIO.sub(1);
      } else {
        sqrtPriceLimitX96 = MIN_SQRT_RATIO.add(1);
      }
    }

    const toAddress = typeof to === "string" ? to : to.address;

    return method(
      amm.address,
      exactInput ? amountIn : amountOut,
      toAddress,
      sqrtPriceLimitX96
    );
  }

  // isFT: boolean,
  // targetPrice: BigNumberish,
  // to: Wallet | string
  const swapToLowerPrice: SwapToPriceFunction = (sqrtPriceX96, to) => {
    return swapToSqrtPrice(true, sqrtPriceX96, to);
  };

  const swapToHigherPrice: SwapToPriceFunction = (sqrtPriceX96, to) => {
    return swapToSqrtPrice(false, sqrtPriceX96, to);
  };

  const swapExact0For1: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(true, [amount, 0], to, sqrtPriceLimitX96);
  };

  const swap0ForExact1: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(true, [0, amount], to, sqrtPriceLimitX96);
  };

  const swapExact1For0: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(false, [amount, 0], to, sqrtPriceLimitX96);
  };

  const swap1ForExact0: SwapFunction = (amount, to, sqrtPriceLimitX96) => {
    return swap(false, [0, amount], to, sqrtPriceLimitX96);
  };

  const mint: MintFunction = async (
    recipient,
    tickLower,
    tickUpper,
    liquidity
  ) => {
    return swapTarget.mint(
      amm.address,
      recipient,
      tickLower,
      tickUpper,
      liquidity
    );
  };

  return {
    swapToLowerPrice,
    swapToHigherPrice,
    swapExact0For1,
    swap0ForExact1,
    swapExact1For0,
    swap1ForExact0,
    mint,
  };
}

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
  return BigNumber.from(n).mul(BigNumber.from(10).pow(18));
}
