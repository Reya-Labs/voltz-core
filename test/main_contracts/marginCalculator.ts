import { Wallet, BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { metaFixture, tickMathFixture } from "../shared/fixtures";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  encodePriceSqrt,
} from "../shared/utilities";
import { expect } from "../shared/expect";

import { getCurrentTimestamp, setTimeNextBlock } from "../helpers/time";
import {
  ERC20Mock,
  TestMarginEngine,
  TestVAMM,
  TickMathTest,
} from "../../typechain";
import { toBn } from "../helpers/toBn";
const ONE_WEEK_IN_SECONDS = 604800;

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

describe("Margin Calculations", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  let marginEngineTest: TestMarginEngine;
  let token: ERC20Mock;

  let testTickMath: TickMathTest;
  let vammTest: TestVAMM;

  let margin_engine_params: any;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    ({ testTickMath } = await loadFixture(tickMathFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ token, marginEngineTest, vammTest } = await loadFixture(metaFixture));
    // set vamm in the margin engine
    await marginEngineTest.setVAMM(vammTest.address);

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));
    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token.approve(wallet.address, BigNumber.from(10).pow(27));

    margin_engine_params = {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: SIGMA_SQUARED,
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,

      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);
  });

  describe("#computeTimeFactor", async () => {
    it("reverts if currentTimestamp is larger than termEndTimestamp", async () => {
      // Would need to use a new MarginEngine, or change immutable config, to test this
      const currentTimestamp = await getCurrentTimestamp(provider);
      await marginEngineTest.setTermTimestamps(0, toBn(currentTimestamp - 1));

      await expect(marginEngineTest.testComputeTimeFactor()).to.be.revertedWith(
        "CT<ET"
      );
    });

    it("correctly computes the time factor", async () => {
      const nextBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await setTimeNextBlock(nextBlockTimestamp);

      const termEndTimestampScaled = toBn(
        (nextBlockTimestamp + ONE_WEEK_IN_SECONDS).toString() // add a week
      );
      await marginEngineTest.setTermTimestamps(0, termEndTimestampScaled);

      const realized = await marginEngineTest.testComputeTimeFactor();

      expect(realized).to.be.eq("981004647228725753");
    });
  });

  describe("#computeApyBound", async () => {
    // passes
    it("correctly computes the Upper APY Bound", async () => {
      const nextBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await setTimeNextBlock(nextBlockTimestamp);

      const termEndTimestampScaled = toBn(
        (nextBlockTimestamp + ONE_WEEK_IN_SECONDS).toString() // add a week
      );
      await marginEngineTest.setTermTimestamps(0, termEndTimestampScaled);

      // const currentTimestampScaled = toBn(nextBlockTimestamp.toString());
      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = true;

      expect(
        await marginEngineTest.testComputeApyBound(historicalApy, isUpper)
      ).to.eq("24278147968583231");
    });

    // passes
    it("correctly computes the Lower APY Bound", async () => {
      const nextBlockTimestamp = (await getCurrentTimestamp(provider)) + 1;
      await setTimeNextBlock(nextBlockTimestamp);

      const termEndTimestampScaled = toBn(
        (nextBlockTimestamp + ONE_WEEK_IN_SECONDS).toString() // add a week
      );
      await marginEngineTest.setTermTimestamps(0, termEndTimestampScaled);

      // const currentTimestampScaled = toBn(nextBlockTimestamp.toString());

      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = false;

      expect(
        await marginEngineTest.testComputeApyBound(historicalApy, isUpper)
      ).to.eq("17456226370556712");
    });
  });

  describe("#worstCaseVariableFactorAtMaturity", async () => {
    it("correctly calculates the worst case variable factor at maturity FT, LM", async () => {
      const isFT = true;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized =
        await marginEngineTest.testWorstCaseVariableFactorAtMaturity(
          isFT,
          isLM,
          historicalApy
        );

      expect(realized).to.eq("2061810633376985");
    });

    it("correctly calculates the worst case variable factor at maturity FT, IM", async () => {
      const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await marginEngineTest.testWorstCaseVariableFactorAtMaturity(
          isFT,
          isLM,
          historicalApy
        );

      expect(realized).to.eq("3092715950065478");
    });

    it("correctly calculates the worst case variable factor at maturity VT, LM", async () => {
      const isFT = false;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized =
        await marginEngineTest.testWorstCaseVariableFactorAtMaturity(
          isFT,
          isLM,
          historicalApy
        );

      expect(realized).to.eq("1771501259394113");
    });

    it("correctly calculates the worst case variable factor at maturity VT, IM", async () => {
      const isFT = false;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await marginEngineTest.testWorstCaseVariableFactorAtMaturity(
          isFT,
          isLM,
          historicalApy
        );

      expect(realized).to.eq("1240050881575879");
    });
  });

  describe("#getPositionMarginRequirement", async () => {
    let tickAt1p: number;
    let tickAt99p: number;
    let tickAt101p: number;

    let priceAt1p: BigNumber;

    before("deploy calculator", async () => {
      tickAt1p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 1)); // 1%
      tickAt99p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 99)); // 99%
      tickAt101p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1, 101)
      ); // 101%

      priceAt1p = await testTickMath.getSqrtRatioAtTick(tickAt1p);
    });

    it("correctly checks for the fact the position is liquidatable", async () => {
      const tickLower = tickAt101p;
      const tickUpper = tickAt99p;
      const currentSqrtPrice = priceAt1p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000000000");

      await marginEngineTest.isCounterfactualPositionLiquidatable(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0")
      );

      const realized = await marginEngineTest.getIsLiquidatable();

      expect(realized).to.eq(true);
    });

    it("correctly checks for the fact the position is not liquidatable", async () => {
      const tickLower = tickAt101p;
      const tickUpper = tickAt99p;
      const currentSqrtPrice = priceAt1p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000000000");

      await marginEngineTest.isCounterfactualPositionLiquidatable(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("400")
      );

      const realized = await marginEngineTest.getIsLiquidatable();

      expect(realized).to.eq(false);
    });
  });
});
