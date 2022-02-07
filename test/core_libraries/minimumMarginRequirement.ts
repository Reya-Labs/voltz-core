import { Wallet, BigNumber, utils} from "ethers";
import { expect } from "chai";
import { ethers, waffle} from "hardhat";
import { toBn } from "evm-bn";
import {
  fixedAndVariableMathFixture,
  marginCalculatorFixture,
} from "../shared/fixtures";
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
  expandTo18Decimals,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";
import { FixedAndVariableMathTest } from "../../typechain";
import { TickMath } from "../shared/tickMath";
import { SqrtPriceMath } from "../shared/sqrtPriceMath";
import JSBI from "jsbi";
import { add, mul } from "../shared/functions";

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

    // todo, setup an array with a range of inputs

    // variableTokenDeltaAbsolute,
    // sqrtRatioCurrX96,
    // startingFixedRateMultiplierWad,
    // fixedRateDeviationMinWad,
    // termEndTimestampWad,
    // currentTimestampWad,
    // tMaxWad,
    // gammaWad,
    // isFTUnwind

    it("sc1", async () => {

      const variableTokenDeltaAbsolute = toBn("100");
      const sqrtRatioCurrX96 = TickMath.getSqrtRatioAtTick(0); // price is 1 => fixed rate is 1%
      console.log("sqrtRatioCurrX96", sqrtRatioCurrX96.toString());
      const startingFixedRateMultiplierWad = toBn("0.5");
      const fixedRateDeviationMinWad = toBn("0.1");
      const termEndTimestampWad = toBn("1675811972"); // approx one year later
      const currentTimestampWad = toBn("1644255020");
      const tMaxWad = toBn("63113904") // two years
      const gammaWad = toBn("1.0");
      const isFTUnwind = true;
  
      const realized = await testMarginCalculator.getAbsoluteFixedTokenDeltaUnbalancedSimulatedUnwind(variableTokenDeltaAbsolute, sqrtRatioCurrX96.toString(), startingFixedRateMultiplierWad, fixedRateDeviationMinWad, termEndTimestampWad, currentTimestampWad, tMaxWad, gammaWad, isFTUnwind);
      console.log("Realized result",  utils.formatEther(realized.toString()));

    })


  })



});
