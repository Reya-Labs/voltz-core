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
import { ScenarioRunner, e2eParameters } from "../general";

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
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    await this.rateOracle.increaseObservationCardinalityNext(1000);

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
      await this.tickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );

    const amount = -300;
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[5][0],
      amountSpecified: toBn(amount.toString()),
      sqrtPriceLimitX96:
        amount > 0
          ? await this.tickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
          : await this.tickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),
      tickLower: this.positions[5][1],
      tickUpper: this.positions[5][2],
    });

    for (let i = 0; i < 88; i++) {
      await advanceTimeAndBlock(consts.ONE_DAY.mul(1), 1);
      await this.e2eSetup.setNewRate(this.getRateInRay(1.003 + i * 0.0025));
    }

    await advanceTimeAndBlock(this.params.duration, 2);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("series of transactions", test);
