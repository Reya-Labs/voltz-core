import { Decimal } from 'decimal.js'
import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, Wallet, ContractTransaction } from "ethers";
import { AMMFactory } from "../typechain/AMMFactory";

import { expect } from "chai";

import {
  MintFunction,
  createAMMFunctions,
  getMinTick,
  getMaxTick,
  FeeAmount,
  TICK_SPACINGS,
  getMaxLiquidityPerTick,
  encodeSqrtRatioX96,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "./shared/utilities";

import { formatPrice, formatTokenAmount } from './shared/format'


import { AMMFixture, TEST_AMM_START_TIME } from "./shared/fixtures";

import { TestAMMCallee } from "../typechain/TestAMMCallee";

import { MockTimeAMM } from "../typechain/MockTimeAMM";

Decimal.config({ toExpNeg: -500, toExpPos: 500 })
const createFixtureLoader = waffle.createFixtureLoader
const { constants } = ethers


interface BaseSwapTestCase {
    zeroForOne: boolean
    sqrtPriceLimit?: BigNumber
  }
  interface SwapExact0For1TestCase extends BaseSwapTestCase {
    zeroForOne: true
    exactOut: false
    amount0: BigNumberish
    sqrtPriceLimit?: BigNumber
  }
  interface SwapExact1For0TestCase extends BaseSwapTestCase {
    zeroForOne: false
    exactOut: false
    amount1: BigNumberish
    sqrtPriceLimit?: BigNumber
  }
  interface Swap0ForExact1TestCase extends BaseSwapTestCase {
    zeroForOne: true
    exactOut: true
    amount1: BigNumberish
    sqrtPriceLimit?: BigNumber
  }
  interface Swap1ForExact0TestCase extends BaseSwapTestCase {
    zeroForOne: false
    exactOut: true
    amount0: BigNumberish
    sqrtPriceLimit?: BigNumber
  }
  interface SwapToHigherPrice extends BaseSwapTestCase {
    zeroForOne: false
    sqrtPriceLimit: BigNumber
  }
  interface SwapToLowerPrice extends BaseSwapTestCase {
    zeroForOne: true
    sqrtPriceLimit: BigNumber
  }
  type SwapTestCase =
    | SwapExact0For1TestCase
    | Swap0ForExact1TestCase
    | SwapExact1For0TestCase
    | Swap1ForExact0TestCase
    | SwapToHigherPrice
    | SwapToLowerPrice


function swapCaseToDescription(testCase: SwapTestCase): string {
    const priceClause = testCase?.sqrtPriceLimit ? ` to price ${formatPrice(testCase.sqrtPriceLimit)}` : ''
    if ('exactOut' in testCase) {
        if (testCase.exactOut) {
        if (testCase.zeroForOne) {
            return `swap token0 for exactly ${formatTokenAmount(testCase.amount1)} token1${priceClause}`
        } else {
            return `swap token1 for exactly ${formatTokenAmount(testCase.amount0)} token0${priceClause}`
        }
        } else {
        if (testCase.zeroForOne) {
            return `swap exactly ${formatTokenAmount(testCase.amount0)} token0 for token1${priceClause}`
        } else {
            return `swap exactly ${formatTokenAmount(testCase.amount1)} token1 for token0${priceClause}`
        }
        }
    } else {
        if (testCase.zeroForOne) {
        return `swap token0 for token1${priceClause}`
        } else {
        return `swap token1 for token0${priceClause}`
        }
    }

}

type AMMFunctions = ReturnType<typeof createAMMFunctions>

// can't use address zero because the ERC20 token does not allow it
const SWAP_RECIPIENT_ADDRESS = constants.AddressZero.slice(0, -1) + '1'
const POSITION_PROCEEDS_OUTPUT_ADDRESS = constants.AddressZero.slice(0, -1) + '2'






async function executeSwap(
    amm: MockTimeAMM,
    testCase: SwapTestCase,
    ammFunctions: AMMFunctions
  ): Promise<ContractTransaction> {
    let swap: ContractTransaction
    if ('exactOut' in testCase) {
      if (testCase.exactOut) {
        if (testCase.zeroForOne) {
          swap = await ammFunctions.swap0ForExact1(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        } else {
          swap = await ammFunctions.swap1ForExact0(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        }
      } else {
        if (testCase.zeroForOne) {
          swap = await ammFunctions.swapExact0For1(testCase.amount0, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        } else {
          swap = await ammFunctions.swapExact1For0(testCase.amount1, SWAP_RECIPIENT_ADDRESS, testCase.sqrtPriceLimit)
        }
      }
    } else {
      if (testCase.zeroForOne) {
        swap = await ammFunctions.swapToLowerPrice(testCase.sqrtPriceLimit, SWAP_RECIPIENT_ADDRESS)
      } else {
        swap = await ammFunctions.swapToHigherPrice(testCase.sqrtPriceLimit, SWAP_RECIPIENT_ADDRESS)
      }
    }
    return swap
}









