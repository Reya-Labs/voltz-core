// mostly new

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
    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + consts.ONE_DAY.toNumber();
    const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

    ({ factory, marginEngineTest } = await loadFixture(metaFixture));

    // const amm = await createAMM(
    //   mainnetConstants.tokens.USDC.address,
    //   RATE_ORACLE_ID,
    //   termStartTimestampBN,
    //   termEndTimestampBN
    // );

    // ({ factory, createMarginEngine, marginEngineCalleeTest } =
    //   await loadFixture(marginEngineFixture));

    // marginEngineTest = await createMarginEngine(amm.address);

    // minTick = getMinTick(TICK_SPACING);
    // maxTick = getMaxTick(TICK_SPACING);

    // tickSpacing = TICK_SPACING;
  });

  describe("#updateTraderMargin", () => {
    it("reverts if margin delta is zero", async () => {
      await expect(
        marginEngineTest.updateTraderMarginTest(0)
      ).to.be.revertedWith("InvalidMarginDelta");
    });
  });

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

  describe("#updateTraderMargin", () => {
    it("allows update by owner", async () => {
      //   const tokenAddress = await marginEngineTest.underlyingToken();
      //   const TokenFactory = await ethers.getContractFactory("ERC20Mock");
      //   const token = await TokenFactory.attach(tokenAddress);
      //   console.log(
      //     `Trader ${
      //       wallet.address
      //     } has token ${tokenAddress} balance of ${await token.balanceOf(
      //       wallet.address
      //     )}`
      //   );
      //   const ammAddress = await marginEngineTest.amm();
      //   const AMMFactory = await ethers.getContractFactory("AMM");
      //   const amm = await AMMFactory.attach(ammAddress);
      //   const tokenAddress2 = await amm.underlyingToken();
      //   const token2 = await TokenFactory.attach(tokenAddress2);
      //   console.log(
      //     `Trader ${
      //       wallet.address
      //     } has token ${tokenAddress2} balance of ${await token2.balanceOf(
      //       wallet.address
      //     )} and allowance to AMM of ${await token2.allowance(
      //       wallet.address,
      //       ammAddress
      //     )}`
      //   );

      await marginEngineTest.updateTraderMargin(500);
      const traderInfo = await marginEngineTest.traders(wallet.address);

      expect(traderInfo.margin).to.eq(500);
    });
  });
});
