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
  termInDays: number,
  termStartTimestamp: number,
  fee: number,
  bytecode: string
): string {
  const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
    ["address", "address", "uint256", "uint256", "uint24"],
    [underlyingToken, underlyingPool, termInDays, termStartTimestamp, fee]
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

export interface AMMFunctions {
  mint: MintFunction;
}

export function createAMMFunctions({
  swapTarget,
  amm,
}: {
  swapTarget: TestAMMCallee;
  amm: MockTimeAMM;
}): AMMFunctions {



  // todo: fix
  async function swapToSqrtPrice(
    isFT: boolean,
    targetPrice: BigNumberish,
    to: Wallet | string
  ): Promise<ContractTransaction> {
    const method = isFT ? swapTarget.swapToHigherSqrtPrice : swapTarget.swapToLowerSqrtPrice

    await inputToken.approve(swapTarget.address, constants.MaxUint256)

    const toAddress = typeof to === 'string' ? to : to.address

    return method(pool.address, targetPrice, toAddress)
  }


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
