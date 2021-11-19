import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { AMMFactory } from "../typechain/AMMFactory";
import { expect } from "chai";

import { toBn } from "evm-bn";
import { div, sub, mul } from "./shared/functions";
import {FixedAndVariableMath} from "../typechain/FixedAndVariableMath";

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
  SwapToPriceFunction,
  SwapFunction,
} from "./shared/utilities";

import { AMMFixture } from "./shared/fixtures";

import { TestAMMCallee } from "../typechain/TestAMMCallee";


import {
  aave_lending_pool_addr,
  usdc_mainnet_addr,
} from "./shared/constants";

const { provider } = waffle;

import {getCurrentTimestamp,
  setTimeNextBlock,
  evm_snapshot,
  evm_revert,
  advanceTime,
  setTime,
  mineBlock
} from "./helpers/time";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { consts  } from "./helpers/constants";

const createFixtureLoader = waffle.createFixtureLoader;

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("AMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: AMMFactory;

  let swapTarget: TestAMMCallee;

  let feeAmount: number;
  let tickSpacing: number;

  let minTick: number;
  let maxTick: number;

  let mint: MintFunction;
  let swapToLowerPrice: SwapToPriceFunction
  let swapToHigherPrice: SwapToPriceFunction
  let swapExact0For1: SwapFunction
  let swap0ForExact1: SwapFunction
  let swapExact1For0: SwapFunction
  let swap1ForExact0: SwapFunction

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  // let createAMM: ThenArg<ReturnType<typeof AMMFixture>>["createAMM"];

  before("create fixture loader", async () => {
    await createSnapshot(provider) ;
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  after(async () => {
    // revert back to initial state after all tests pass
    await restoreSnapshot(provider);
  });

  beforeEach("deploy fixture", async () => {
    await createSnapshot(provider);
    ({
      factory,
      swapTargetCallee: swapTarget,
      // createAMM,
    } = await loadFixture(AMMFixture));

  }); 

  afterEach(async () => {
    await restoreSnapshot(provider);
  });

  


});
