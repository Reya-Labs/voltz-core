// hybrid of uniswap v3 pool and new
import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { vammFixture, ammFixture, metaFixture } from "../shared/fixtures";
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
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import { TestAMM } from "../../typechain/TestAMM";

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: Factory;
  let ammTest: TestAMM;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let vammCalleeTest: TestVAMMCallee;
  let marginEngineCalleeTest: TestMarginEngineCallee;

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

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      ammTest,
      vammTest,
      marginEngineTest,
      vammCalleeTest,
      marginEngineCalleeTest,
    } = await loadFixture(metaFixture));

    minTick = getMinTick(TICK_SPACING);
    maxTick = getMaxTick(TICK_SPACING);

    tickSpacing = TICK_SPACING;
  });

  describe("#quickChecks", async () => {
    it("check underlying token of the amm set correctly", async () => {
      const underlyingToken: string = await ammTest.underlyingToken();
      expect(underlyingToken.toLowerCase()).to.eq(
        mainnetConstants.tokens.USDC.address.toLowerCase()
      );
      // await expect(ammTest.underlyingToken()).to.eq(mainnetConstants.tokens.USDC.address);
    });

    it("check the margin engine can call the amm", async () => {
      const underlyingToken: string =
        await marginEngineTest.getUnderlyingToken();
      expect(underlyingToken.toLowerCase()).to.eq(
        mainnetConstants.tokens.USDC.address.toLowerCase()
      );
    });

    it("check the amm can call the vamm", async () => {
      // (, int24 tick,) = amm.vamm().slot0();
      const currentTick = await ammTest.testGetCurrentTickFromVAMM();
      console.log("Current Tick is", currentTick);
      expect(currentTick).to.eq(0);
    });

    // it("check the rate for termStartTimestamp has been set", async () => {
    //   const
    // })
  });

  describe("#initialize", async () => {
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

  describe("#mint", () => {
    it("fails if not initialized", async () => {
      await expect(
        vammCalleeTest.mintTest(
          vammTest.address,
          wallet.address,
          -tickSpacing,
          tickSpacing,
          1
        )
      ).to.be.reverted;
    });

    describe("after initialization", async () => {
      beforeEach("initialize the pool at price of 10:1", async () => {
        await vammTest.initialize(encodeSqrtRatioX96(1, 10).toString());
        await vammCalleeTest.mintTest(
          vammTest.address,
          wallet.address,
          minTick,
          maxTick,
          3161
        );
      });

      // describe("failure cases", async () => {

      //   it('fails if tickLower greater than tickUpper', async () => {
      //     await expect(vammCalleeTest.mintTest(vammTest.address, wallet.address, 1, 0, 1)).to.be.reverted
      //   })

      // })
    });
  });

  // describe("#mint", () => {
  //   it("fails if not initialized", async () => {
  //     await expect(

  //       vammTest.mintTest(wallet.address, -tickSpacing, tickSpacing, 1)
  //     ).to.be.reverted;
  //   });
  //   // more tests in here
  //   // using callee results in a timeout for some reason, haven't been able to debug yet
  // });
});
