// mostly new

import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { expect } from "../shared/expect";
import { marginEngineFixture, ammFixture } from "../shared/fixtures";
// import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import {
  getPositionKey,
  getMaxTick,
  getMinTick,
  TICK_SPACING,
  createVAMMMFunctions,
  SwapFunction,
  MintFunction,
  getMaxLiquidityPerTick,
  MaxUint128,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
  encodeSqrtRatioX96,
  SwapToPriceFunction,
  mint,
} from "../shared/utilities";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { RATE_ORACLE_ID } from "../shared/utilities";
import { getCurrentTimestamp } from "../helpers/time";
const { provider } = waffle;
import { toBn } from "evm-bn";
import { consts } from "../helpers/constants";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  let factory: Factory;
  let marginEngineTest: TestMarginEngine;
  let marginEngineCalleeTest: TestMarginEngineCallee;

  let tickSpacing: number;
  let minTick: number;
  let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  let createMarginEngine: ThenArg<
    ReturnType<typeof marginEngineFixture>
  >["createMarginEngine"];
  let createAMM: ThenArg<ReturnType<typeof ammFixture>>["createAMM"];

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + consts.ONE_DAY.toNumber();
    const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

    ({ factory, createAMM } = await loadFixture(ammFixture));

    const amm = await createAMM(
      mainnetConstants.tokens.USDC.address,
      RATE_ORACLE_ID,
      termStartTimestampBN,
      termEndTimestampBN
    );

    ({ factory, createMarginEngine, marginEngineCalleeTest } =
      await loadFixture(marginEngineFixture));

    marginEngineTest = await createMarginEngine(amm.address);

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });

  describe("#updateTraderMargin", () => {
    it("reverts if margin delta is zero", async () => {
      await expect(marginEngineTest.updateTraderMarginTest(wallet.address, 0))
        .to.be.reverted;
    });
  });
});
