import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { e2eParametersGeneral } from "../e2eSetup";
import { ScenarioRunner } from "../newGeneral";

const e2eParams: e2eParametersGeneral = {
  duration: consts.ONE_MONTH.mul(3),
  numActors: 5,
  marginCalculatorParams: {
    apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
    apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
    minDeltaLMWad: MIN_DELTA_LM,
    minDeltaIMWad: MIN_DELTA_IM,
    sigmaSquaredWad: toBn("0.15"),
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
  },
  lookBackWindowAPY: consts.ONE_WEEK,
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 5,
  fee: toBn("0.01"),
  tickSpacing: TICK_SPACING,
  positions: [
    [0, -TICK_SPACING, 0],
    [1, -TICK_SPACING, 0],
    [2, -TICK_SPACING, 0],
    [3, -TICK_SPACING, 0],
    [4, -TICK_SPACING, 0],
  ],
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());
    for (const p of this.positions) {
      await this.e2eSetup.updatePositionMarginViaAMM(
        p[0],
        p[1],
        p[2],
        toBn("25")
      );
    }

    await this.rateOracle.increaseObservationCardinalityNext(1000);
    await this.rateOracle.increaseObservationCardinalityNext(2000);

    // each LP deposits 1,010 liquidity 100 times

    for (let i = 0; i < 100; i++) {
      console.log("mint phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.mintViaAMM(p[0], p[1], p[2], toBn("1001"));
      }
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(25), 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0012));

    for (const p of this.positions) {
      await this.e2eSetup.updatePositionMarginViaAMM(
        p[0],
        p[1],
        p[2],
        toBn("100")
      );
    }

    const sqrtPriceLimit = await this.tickMath.getSqrtRatioAtTick(
      -TICK_SPACING
    );

    for (let i = 0; i < 100; i++) {
      console.log("swap phase: ", i);
      for (const p of this.positions) {
        await this.e2eSetup.swapViaAMM({
          recipient: p[0],
          amountSpecified: toBn("-3"),
          sqrtPriceLimitX96: sqrtPriceLimit,

          tickLower: p[1],
          tickUpper: p[2],
        });
      }
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0081));

    await advanceTimeAndBlock(this.params.duration, 1);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("Series of mints and swaps", test);
