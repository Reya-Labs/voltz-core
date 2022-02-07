import { Wallet, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";
import { marginCalculatorFixture } from "../shared/fixtures";
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
  encodeSqrtRatioX96,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";
import { TickMath } from "../shared/tickMath";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

describe("MarginCalculator", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;
  let testMarginCalculator: MarginCalculatorTest;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
  });

  describe("#getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind", async () => {
    // todo, setup an array with a range of inputs and scenarios

    it("isFTUnwind", async () => {
      const variableTokenDeltaAbsolute = toBn("100");
      const sqrtRatioCurrX96 = TickMath.getSqrtRatioAtTick(0); // price is 1 => fixed rate is 1%
      const startingFixedRateMultiplierWad = toBn("0.5");
      const fixedRateDeviationMinWad = toBn("0.1");
      const termEndTimestampWad = toBn("1675811972"); // approx one year later
      const currentTimestampWad = toBn("1644255020");
      const tMaxWad = toBn("63113904"); // two years
      const gammaWad = toBn("1.0");
      const isFTUnwind = true;

      const realized =
        await testMarginCalculator.getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(
          variableTokenDeltaAbsolute,
          sqrtRatioCurrX96.toString(),
          startingFixedRateMultiplierWad,
          fixedRateDeviationMinWad,
          termEndTimestampWad,
          currentTimestampWad,
          tMaxWad,
          gammaWad,
          isFTUnwind
        );
      expect(realized).to.eq(toBn("80.3265329856316712"));
    });
  });

  describe("#getMinimumMarginRequirement", async () => {
    it("sc1", async () => {
      const margin_engine_params = {
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

        devMulLeftUnwindLMWad: toBn("0.5"),
        devMulRightUnwindLMWad: toBn("0.5"),
        devMulLeftUnwindIMWad: toBn("0.8"),
        devMulRightUnwindIMWad: toBn("0.8"),

        fixedRateDeviationMinLeftUnwindLMWad: toBn("0.1"),
        fixedRateDeviationMinRightUnwindLMWad: toBn("0.1"),

        fixedRateDeviationMinLeftUnwindIMWad: toBn("0.3"),
        fixedRateDeviationMinRightUnwindIMWad: toBn("0.3"),

        gammaWad: toBn("1.0"),
        minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
      };

      const termStartTimestamp = await getCurrentTimestamp(provider);

      const termStartTimestampWad = toBn(termStartTimestamp.toString());

      const termEndTimestampWad = toBn(
        (termStartTimestamp + 31556952).toString() // add a year
      );

      const trader_margin_requirement_params = {
        fixedTokenBalance: toBn("1000"),
        variableTokenBalance: toBn("-100"),
        termStartTimestampWad: termStartTimestampWad,
        termEndTimestampWad: termEndTimestampWad,
        isLM: true,
        historicalApyWad: toBn("0.5"),
        sqrtPriceX96: encodeSqrtRatioX96(1, 10).toString(),
        variableFactorWad: toBn("0"),
      };

      const realized = await testMarginCalculator.getMinimumMarginRequirement(
        trader_margin_requirement_params,
        margin_engine_params
      );

      console.log(
        "realized minimum trader margin requirement",
        utils.formatEther(realized.toString())
      );

      // set up an excel scenario to test this works accordingly
    });
  });
});
