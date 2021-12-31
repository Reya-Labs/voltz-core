import { ethers, waffle } from "hardhat";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Factory } from "../../typechain/Factory";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { expect } from "../shared/expect";
import { metaFixture } from "../shared/fixtures";
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

// const initialTraderInfo = {
//   margin: BigNumber.from(0),
//   fixedTokenBalance: BigNumber.from(0),
//   variableTokenBalance: BigNumber.from(0),
//   isSettled: false,
// };

const createFixtureLoader = waffle.createFixtureLoader;
type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

describe("MarginEngine", () => {
  let wallet: Wallet, other: Wallet;
  let factory: Factory;
  let marginEngineTest: TestMarginEngine;
  let marginEngineCalleeTest: TestMarginEngineCallee;

  //   let tickSpacing: number;
  //   let minTick: number;
  //   let maxTick: number;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {

    ({ factory, marginEngineTest } = await loadFixture(metaFixture));

  });

  // describe("#updateTraderMargin", () => {
  //   it("reverts if margin delta is zero", async () => {
  //     await expect(
  //       marginEngineTest.updateTraderMarginTest(0)
  //     ).to.be.revertedWith("InvalidMarginDelta");
  //   });
  // });

  describe("#traders", () => {
    it("returns empty trader by default", async () => {
      const traderInfo = await marginEngineTest.traders(wallet.address);
      expect(traderInfo.margin).to.eq(0);
      expect(traderInfo.fixedTokenBalance).to.eq(0);
      expect(traderInfo.variableTokenBalance).to.eq(0);
      expect(traderInfo.isSettled).to.eq(false);
    });
  });

  describe("#positions", () => {
    it("returns empty position by default", async () => {
      const positionInfo = await marginEngineTest.getPosition(
        wallet.address,
        0,
        1
      );
      expect(positionInfo._liquidity).to.eq(0);
      expect(positionInfo.margin).to.eq(0);
      expect(positionInfo.fixedTokenGrowthInsideLast).to.eq(0);
      expect(positionInfo.variableTokenGrowthInsideLast).to.eq(0);
      expect(positionInfo.fixedTokenBalance).to.eq(0);
      expect(positionInfo.variableTokenBalance).to.eq(0);
      expect(positionInfo.feeGrowthInsideLast).to.eq(0);
      expect(positionInfo.isBurned).to.eq(false);
      expect(positionInfo.isBurned).to.eq(false);
    });
  });

  
});
