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
import { e2eParameters } from "../e2eSetup";
import { ScenarioRunner } from "../general";

const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(3),
  numActors: 6,
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
  feeProtocol: 0,
  fee: toBn("0"),
  tickSpacing: TICK_SPACING,
  positions: [
    [0, -TICK_SPACING, TICK_SPACING],
    [1, -3 * TICK_SPACING, -TICK_SPACING],
    [0, -3 * TICK_SPACING, TICK_SPACING],
    [0, 0, TICK_SPACING],
    [2, -3 * TICK_SPACING, TICK_SPACING],
    [3, -TICK_SPACING, TICK_SPACING],
    [4, -TICK_SPACING, TICK_SPACING],
    [5, -TICK_SPACING, TICK_SPACING],
  ],
  skipped: true,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);

    const liquidityDeltaBn = toBn("100000");

    const marginRequirement = await this.getMintInfoViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      liquidityDeltaBn
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn(marginRequirement.toString())
    );

    await this.e2eSetup.mintViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      liquidityDeltaBn
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[5][0],
      this.positions[5][1],
      this.positions[5][2],
      toBn("10000")
    );

    const amount_fcm = 150;
    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      this.positions[5][0],
      toBn(amount_fcm.toString()),
      await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );

    const amount = -300;
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[5][0],
      amountSpecified: toBn(amount.toString()),
      sqrtPriceLimitX96:
        amount > 0
          ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
          : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
      tickLower: this.positions[5][1],
      tickUpper: this.positions[5][2],
    });

    for (let i = 0; i < 88; i++) {
      await this.advanceAndUpdateApy(
        consts.ONE_DAY.mul(1),
        1,
        1.003 + i * 0.0025
      );
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90), 2);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 13);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario13/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 13", test);
