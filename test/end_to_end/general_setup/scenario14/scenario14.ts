import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  encodeSqrtRatioX96,
  TICK_SPACING,
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
    gap7: toBn("0"),

    minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
  },
  lookBackWindowAPY: consts.ONE_WEEK,
  startingPrice: encodeSqrtRatioX96(1, 1),
  feeProtocol: 5,
  fee: toBn("0.01"),
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

    await this.marginEngine.setLookbackWindowInSeconds(consts.ONE_WEEK);
    await this.marginEngine.setCacheMaxAgeInSeconds(consts.ONE_DAY);

    await this.rateOracle.increaseObservationCardinalityNext(1000);

    for (let i = 0; i < 15; i++) {
      await advanceTimeAndBlock(consts.ONE_DAY, 2);
      await this.e2eSetup.setNewRate(this.getRateInRay(1 + (i + 1) / 3650));
    }

    const p = this.positions[0];
    const positionMarginRequirement = await this.getMintInfoViaAMM(
      p[0],
      p[1],
      p[2],
      toBn("100000")
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      p[0],
      p[1],
      p[2],
      toBn(positionMarginRequirement.toString())
    );

    await this.e2eSetup.mintViaAMM(p[0], p[1], p[2], toBn("100000"));

    await advanceTimeAndBlock(this.params.duration, 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("position requirement after 15 days", test);
