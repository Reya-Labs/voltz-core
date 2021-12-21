import {
  BigNumber,
  BigNumberish,
  ContractTransaction,
  utils,
  Wallet,
} from "ethers";
// import { TestAMMCallee } from "../../typechain/TestAMMCallee";
// import { MockTimeAMM } from "../../typechain/MockTimeAMM";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
import JSBI from "jsbi";
import { BigintIsh } from "./constants";
import { sqrt } from "./sqrt";
import { div, sub, mul } from "./functions";
import { toBn } from "evm-bn";


export const TICK_SPACING: number = 60;

export const SECONDS_IN_YEAR: BigNumber = toBn("31536000");
// export const BLOCK_TIMESTAMP: number = 1632249308;
export const MaxUint128 = BigNumber.from(2).pow(128).sub(1);

export type MintFunction = (
  recipient: string,
  tickLower: BigNumberish,
  tickUpper: BigNumberish,
  liquidity: BigNumberish,
  vammCalleeTest: TestVAMMCallee,
  vammTest: TestVAMM,
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

export interface VAMMFunctions {
  mint: MintFunction;
  swapToLowerPrice: SwapToPriceFunction;
  swapToHigherPrice: SwapToPriceFunction;
  swapExact0For1: SwapFunction;
  swap0ForExact1: SwapFunction;
  swapExact1For0: SwapFunction;
  swap1ForExact0: SwapFunction;
}


export const mint: MintFunction = async (
  recipient,
  tickLower,
  tickUpper,
  liquidity,
  vammCalleeTest,
  vammTest
) => {
  return vammCalleeTest.mintTest(
    vammTest.address,
    recipient,
    tickLower,
    tickUpper,
    liquidity
  );
};


// convert into above
export function createVAMMMFunctions({
  vammCalleeTest,
  vammTest,
}: {
  vammCalleeTest: TestVAMMCallee;
  vammTest: TestVAMM;
}): VAMMFunctions {
  async function swapToSqrtPrice(
    isFT: boolean,
    targetPrice: BigNumberish,
    to: Wallet | string
  ): Promise<ContractTransaction> {
    const method = isFT
      ? vammCalleeTest.swapToHigherSqrtPrice
      : vammCalleeTest.swapToLowerSqrtPrice;

    const toAddress = typeof to === "string" ? to : to.address;

    return method(vammTest.address, targetPrice, toAddress);
  }

  async function swap(
    isFT: boolean,
    [amountIn, amountOut]: [BigNumberish, BigNumberish],
    to: Wallet | string,
    sqrtPriceLimitX96?: BigNumberish
  ): Promise<ContractTransaction> {
    const exactInput = amountOut === 0;

    // todo: make sure this is correct (isFT vs. !isFT)
    const method = isFT
      ? exactInput
        ? vammCalleeTest.swapExact1For0
        : vammCalleeTest.swap1ForExact0
      : exactInput
      ? vammCalleeTest.swapExact0For1
      : vammCalleeTest.swap0ForExact1;

    if (typeof sqrtPriceLimitX96 === "undefined") {
      // isFT vs. !isFT
      if (isFT) {
        sqrtPriceLimitX96 = MAX_SQRT_RATIO.sub(1);
      } else {
        sqrtPriceLimitX96 = MIN_SQRT_RATIO.add(1);
      }
    }

    const toAddress = typeof to === "string" ? to : to.address;

    return method(
      vammTest.address,
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
    return vammCalleeTest.mintTest(
      vammTest.address,
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

  // const currentBlockTimestamp = toBn(BLOCK_TIMESTAMP.toString());

  if (atMaturity) {
    timeInSeconds = sub(termEndTimestamp, termStartTimestamp);
  } else {
    // timeInSeconds = sub(toBn(Math.floor(Date.now()/1000).toString()), termStartTimestamp)
    timeInSeconds = sub(currentBlockTimestamp, termStartTimestamp);
  }

  const timeInYears: BigNumber = accrualFact(timeInSeconds);

  console.log(`Test: Time in Years in a fixed factor call is ${timeInYears}`);

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
export const APY_UPPER_MULTIPLIER: BigNumber = toBn("1.5"); // todo: use Neil's toBn implementation
export const APY_LOWER_MULTIPLIER: BigNumber = toBn("0.7");
export const MIN_DELTA_LM: BigNumber = toBn("0.03");
export const MIN_DELTA_IM: BigNumber = toBn("0.06");
export const MAX_LEVERAGE: BigNumber = toBn("10.0");
export const SIGMA_SQUARED: BigNumber = toBn("0.01");
export const ALPHA: BigNumber = toBn("0.04");
export const BETA: BigNumber = toBn("1.0");
export const XI_UPPER: BigNumber = toBn("2.0");
export const XI_LOWER: BigNumber = toBn("1.5");
export const RATE_ORACLE_ID: string = utils.formatBytes32String("AaveV2"); // just aave for now
export const DEFAULT_TIME_FACTOR: BigNumber = toBn("0.1");
export const MIN_TICK: number = -887272;
export const MAX_TICK: number = 887272;
