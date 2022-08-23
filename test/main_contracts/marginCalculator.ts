import { Wallet, BigNumber, utils } from "ethers";
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
  TestRateOracle,
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
  let rateOracleTest: TestRateOracle;
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
    ({ token, marginEngineTest, vammTest, rateOracleTest } = await loadFixture(
      metaFixture
    ));
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

      const rateIndex = (await rateOracleTest.oracleVars()).rateIndex;

      for (let i = 0; i <= rateIndex; i++) {
        const [rateTimestamp, rateValue] = await rateOracleTest.observations(i);
        console.log("entry:", rateTimestamp.toString(), rateValue.toString());
      }

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

  describe("#getTraderMarginRequirement", async () => {
    beforeEach("change parameters", async () => {
      const new_margin_engine_params = {
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

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
      };

      await marginEngineTest.setMarginCalculatorParameters(
        new_margin_engine_params
      );
    });

    it.only("correctly calculates the margin requirement: FT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");
      const isLM = true;

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("8.52014794271"));
    });

    it("correctly calculates the margin requirement: FT, LM with <0", async () => {
      const fixedTokenBalance: BigNumber = toBn("10");
      const variableTokenBalance: BigNumber = toBn("-30000000");
      const isLM = true;

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("87119.2857285"));
    });

    it("correctly calculates the margin requirement: FT, LM with <0", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-3000");
      const isLM = false;

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("8.76603697634"));
    });

    it("correctly calculates the margin requirement: VT, LM", async () => {
      const fixedTokenBalance: BigNumber = toBn("-1000");
      const variableTokenBalance: BigNumber = toBn("3000");
      const isLM = true;

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("0.171249348113833000"));
    });

    it("correctly calculates the margin requirement: FT, IM", async () => {
      const fixedTokenBalance: BigNumber = toBn("1000");
      const variableTokenBalance: BigNumber = toBn("-30000");
      const isLM = false;

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("0.927603785405792000"));
    });
  });

  describe("#getPositionMarginRequirement", async () => {
    let tickAt0001p: number;
    let tickAt1p: number;
    let tickAt2p: number;
    let tickAt4p: number;
    let tickAt10p: number;
    let tickAt15p: number;
    let tickAt20p: number;
    let tickAt99p: number;
    let tickAt101p: number;
    let tickAt1000p: number;

    let priceAt0001p: BigNumber;
    let priceAt1p: BigNumber;
    let priceAt2p: BigNumber;
    let priceAt4p: BigNumber;
    let priceAt10p: BigNumber;
    let priceAt15p: BigNumber;
    let priceAt20p: BigNumber;
    let priceAt1000p: BigNumber;

    before("deploy calculator", async () => {
      tickAt0001p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1000, 1)
      ); // 0.001%
      tickAt1p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 1)); // 1%
      tickAt2p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 2)); // 2%
      tickAt4p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 4)); // 4%
      tickAt10p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 10)); // 10%
      tickAt15p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 15)); // 15%
      tickAt20p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 20)); // 20%
      tickAt99p = await testTickMath.getTickAtSqrtRatio(encodePriceSqrt(1, 99)); // 99%
      tickAt101p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1, 101)
      ); // 101%
      tickAt1000p = await testTickMath.getTickAtSqrtRatio(
        encodePriceSqrt(1, 1000)
      ); // 1000%

      priceAt0001p = await testTickMath.getSqrtRatioAtTick(tickAt0001p);
      priceAt1p = await testTickMath.getSqrtRatioAtTick(tickAt1p);
      priceAt2p = await testTickMath.getSqrtRatioAtTick(tickAt2p);
      priceAt4p = await testTickMath.getSqrtRatioAtTick(tickAt4p);
      priceAt10p = await testTickMath.getSqrtRatioAtTick(tickAt10p);
      priceAt15p = await testTickMath.getSqrtRatioAtTick(tickAt15p);
      priceAt20p = await testTickMath.getSqrtRatioAtTick(tickAt20p);
      priceAt1000p = await testTickMath.getSqrtRatioAtTick(tickAt1000p);
    });

    it("current tick < lower tick: margin requirement for upper tick | no minimum", async () => {
      const tickLower = tickAt4p;
      const tickUpper = tickAt2p;
      const currentSqrtPrice = priceAt10p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.110927831816756198"));
    });

    it("current tick < lower tick: margin requirement for lower tick | minimum", async () => {
      const tickLower = tickAt4p;
      const tickUpper = tickAt2p;
      const currentSqrtPrice = priceAt10p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("585.80");
      const variableTokenBalance: BigNumber = toBn("-207.10");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.288637791189893257"));
    });

    it("lower tick < current tick < upper tick: margin requirement for upper tick | no minimum", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt2p;
      const currentSqrtPrice = priceAt4p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("-1162");
      const variableTokenBalance: BigNumber = toBn("183");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.332524547647427475"));
    });

    it("lower tick < current tick < upper tick: margin requirement for lower tick | minimum", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt2p;
      const currentSqrtPrice = priceAt4p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.132907391350678334"));
    });

    it("upper tick < current tick: margin requirement for lower tick | minimum", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt2p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.132907391350678334"));
    });

    it("upper tick < current tick: margin requirement for lower tick | minimum | 10% starting fixed rate", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt10p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("100");
      const variableTokenBalance: BigNumber = toBn("-100000");
      const liquidityBN: BigNumber = toBn("0");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("193.598556094"));
    });

    it("upper tick < current tick: margin requirement for lower tick | minimum | 15% starting fixed rate", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt15p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("100");
      const variableTokenBalance: BigNumber = toBn("-100000");
      const liquidityBN: BigNumber = toBn("0");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("290.378447406"));
    });

    it("upper tick < current tick: margin requirement for lower tick | minimum | 20% starting fixed rate", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt20p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("100");
      const variableTokenBalance: BigNumber = toBn("-100000");
      const liquidityBN: BigNumber = toBn("0");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("290.378447406"));
    });

    it("upper tick < current tick: margin requirement for lower tick | minimum | 10000% starting fixed rate", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt1000p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("100");
      const variableTokenBalance: BigNumber = toBn("-100000");
      const liquidityBN: BigNumber = toBn("0");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("290.378447406"));
    });

    it("upper tick < current tick: margin requirement for upper tick | no minimum", async () => {
      const tickLower = tickAt10p;
      const tickUpper = tickAt4p;
      const currentSqrtPrice = priceAt2p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("-1162");
      const variableTokenBalance: BigNumber = toBn("183");
      const liquidityBN: BigNumber = toBn("1000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      expect(realized).to.be.near(toBn("0.221596899268525351"));
    });

    it("case 1 of mc and fcm pdf", async () => {
      const fixedTokenBalance: BigNumber = toBn("-500000");
      const variableTokenBalance: BigNumber = toBn("1000000");
      const isLM = false;

      await vammTest.initializeVAMM(priceAt0001p);

      await marginEngineTest.getMarginRequirementTest(
        fixedTokenBalance,
        variableTokenBalance,
        isLM
      );
      const realized = await marginEngineTest.getMargin();

      expect(realized).to.be.near(toBn("95.890410958904000000"));
    });

    it("case 2 of mc and fcm pdf", async () => {
      const tickLower = tickAt101p;
      const tickUpper = tickAt99p;
      const currentSqrtPrice = priceAt1p;

      await vammTest.initializeVAMM(currentSqrtPrice);

      const fixedTokenBalance: BigNumber = toBn("0");
      const variableTokenBalance: BigNumber = toBn("0");
      const liquidityBN: BigNumber = toBn("1000000000");
      const isLM = true;

      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        tickLower,
        tickUpper,
        liquidityBN,
        fixedTokenBalance,
        variableTokenBalance,
        toBn("0"),
        isLM
      );
      const realized = await marginEngineTest.getMargin();
      console.log("position margin requirement", utils.formatEther(realized));

      // expect(realized).to.be.near(toBn("376.683468876737102989"));
      expect(realized).to.be.near(toBn("0"));
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

      expect(realized).to.eq(false);
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
