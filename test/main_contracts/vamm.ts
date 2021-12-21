// hybrid of uniswap v3 pool and new
import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { vammFixture, ammFixture } from "../shared/fixtures";
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
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
import { consts } from "../helpers/constants";
// import { devConstants, mainnetConstants } from "../helpers/constants";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { RATE_ORACLE_ID } from "../shared/utilities";
import { getCurrentTimestamp } from "../helpers/time";
const { provider } = waffle;
import { toBn } from "evm-bn";

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: Factory;
  let vammTest: TestVAMM;
  let vammCalleeTest: TestVAMMCallee;

  // let swapToLowerPrice: SwapToPriceFunction;
  // let swapToHigherPrice: SwapToPriceFunction;
  // let swapExact0For1: SwapFunction;
  // let swap0ForExact1: SwapFunction;
  // let swapExact1For0: SwapFunction;
  // let swap1ForExact0: SwapFunction;
  // let mint: MintFunction;

  let tickSpacing: number;
  let minTick: number;
  let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  let createVAMM: ThenArg<ReturnType<typeof vammFixture>>["createVAMM"];
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

    ({ factory, createVAMM, vammCalleeTest } = await loadFixture(vammFixture));

    vammTest = await createVAMM(amm.address);

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });

  describe("#initialize", () => async () => {
    it("fails if already initialized", async () => {
      await vammTest.initialize(encodeSqrtRatioX96(1, 1).toString());
      await expect(vammTest.initialize(encodeSqrtRatioX96(1, 1).toString())).to
        .be.reverted;
    });

    it("fails if starting price is too low", async () => {
      await expect(vammTest.initialize(1)).to.be.reverted;
      await expect(vammTest.initialize(MIN_SQRT_RATIO.sub(1))).to.be.reverted;
      // await expect(pool.initialize(1)).to.be.revertedWith('R')
      // await expect(pool.initialize(MIN_SQRT_RATIO.sub(1))).to.be.revertedWith('R')
    });

    it("fails if starting price is too high", async () => {
      await expect(vammTest.initialize(MAX_SQRT_RATIO)).to.be.reverted;
      await expect(vammTest.initialize(BigNumber.from(2).pow(160).sub(1))).to.be
        .reverted;
    });

    it("can be initialized at MIN_SQRT_RATIO", async () => {
      await vammTest.initialize(MIN_SQRT_RATIO);
      expect((await vammTest.slot0()).tick).to.eq(getMinTick(1));
    });

    // more tests in here
  });

  // describe("#mint", () => {
  //   it('fails if not initialized', async () => {
  //     await expect(vammCalleeTest.mintTest(vammTest.address, wallet.address, -tickSpacing, tickSpacing, 1)).to.be.reverted;
  //   })
  // })

  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(
        vammTest.mintTest(wallet.address, -tickSpacing, tickSpacing, 1)
      ).to.be.reverted;
    });
    // more tests in here
    // using callee results in a timeout for some reason, haven't been able to debug yet
  });
});
