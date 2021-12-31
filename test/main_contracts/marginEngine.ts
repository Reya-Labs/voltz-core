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
import { TestAMM } from "../../typechain/TestAMM";

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
  // let marginEngineCalleeTest: TestMarginEngineCallee;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#updateTraderMargin", () => {
    
    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {

      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
  
    });

    it("reverts if margin delta is zero", async () => {
      await expect(
        marginEngineTest.updateTraderMarginTest(0)
      ).to.be.revertedWith("InvalidMarginDelta");
    });

  });

  describe("#traders", () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {
      

      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
  
    });

    it("returns empty trader by default", async () => {
      const traderInfo = await marginEngineTest.traders(wallet.address);
      expect(traderInfo.margin).to.eq(0);
      expect(traderInfo.fixedTokenBalance).to.eq(0);
      expect(traderInfo.variableTokenBalance).to.eq(0);
      expect(traderInfo.isSettled).to.eq(false);
    });
  });

  describe("#positions", () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {

      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
  
    });

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
      // expect(positionInfo.isBurned).to.eq(false);
    });
  });

  describe("#checkTraderMargin", async () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {

      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
  
    });
    
    it("check position margin above requirement", async () => {
      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");
      const ammAddress = await marginEngineTest.amm();

      await expect(marginEngineTest.checkTraderMarginAboveRequirementTest(updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance, ammAddress)).to.be.reverted;
    })

    it("check trader margin can be updated", async () => {
      // int256 updatedMarginWouldBe,
      // int256 fixedTokenBalance,
      // int256 variableTokenBalance,
      // bool isTraderSettled,
      // address ammAddress

      const updatedMarginWouldBe = toBn("0");
      const fixedTokenBalance = toBn("1000");
      const variableTokenBalance = toBn("-2000");
      const ammAddress = await marginEngineTest.amm();
      const isTraderSettled = false;

      await expect(marginEngineTest.checkTraderMarginCanBeUpdated(updatedMarginWouldBe, fixedTokenBalance, variableTokenBalance, isTraderSettled, ammAddress)).to.be.reverted;      

    })

  });


  describe("#checkPositionMargin", async () => {

    let marginEngineTest: TestMarginEngine;
    let factory: Factory;

    beforeEach("deploy fixture", async () => {

      ({ factory, marginEngineTest } = await loadFixture(metaFixture));
  
    });

    it("check position margin above requirement reverted", async () => {

      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const liquidityDelta = 10;
      const updatedMarginWouldBe = toBn("0");
      const positionLiquidity = 10;
      const positionFixedTokenBalance = toBn("0");
      const positionVariableTokenBalance = toBn("0");
      const variableFactor = toBn("0.1");
      const ammAddress = await marginEngineTest.amm();

      await expect(marginEngineTest.checkPositionMarginAboveRequirementTest(owner, tickLower, tickUpper, liquidityDelta, updatedMarginWouldBe, positionLiquidity, positionFixedTokenBalance, positionVariableTokenBalance, variableFactor, ammAddress)).to.be.reverted;
    
    })

    it("check position margin can be updated reverted", async () => {

      const owner = wallet.address;
      const tickLower = -1;
      const tickUpper = 1;
      const liquidityDelta = 10;
      const updatedMarginWouldBe = toBn("0");
      const positionLiquidity = 10;
      const positionFixedTokenBalance = toBn("0");
      const positionVariableTokenBalance = toBn("0");
      const variableFactor = toBn("0.1");
      const ammAddress = await marginEngineTest.amm();
      const isPositionBurned = false;
      const isPositionSettled = false;

      await expect(marginEngineTest.checkPositionMarginCanBeUpdatedTest(owner, tickLower, tickUpper, liquidityDelta, updatedMarginWouldBe, isPositionBurned, isPositionSettled, positionLiquidity, positionFixedTokenBalance, positionVariableTokenBalance, variableFactor, ammAddress)).to.be.reverted;
    
    })

  })


  

  
});
