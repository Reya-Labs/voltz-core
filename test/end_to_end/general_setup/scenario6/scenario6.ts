import { toBn } from "evm-bn";
import { random } from "mathjs";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TickMath } from "../../../shared/tickMath";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodePriceSqrt,
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
  duration: consts.ONE_YEAR,
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
  lookBackWindowAPY: consts.ONE_WEEK.mul(4),
  startingPrice: encodeSqrtRatioX96(1, 6),
  feeProtocol: 0,
  fee: toBn("0"),
  tickSpacing: TICK_SPACING,
  positions: [
    [
      0,
      Math.floor(
        TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 8)) / TICK_SPACING
      ) * TICK_SPACING,
      Math.floor(
        TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 4)) / TICK_SPACING
      ) * TICK_SPACING,
    ], // 4% -- 8%
    [
      1,
      Math.floor(
        TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 10)) / TICK_SPACING
      ) * TICK_SPACING,
      Math.floor(
        TickMath.getTickAtSqrtRatio(encodeSqrtRatioX96(1, 6)) / TICK_SPACING
      ) * TICK_SPACING,
    ], // 6% -- 10%
    [2, -TICK_SPACING, TICK_SPACING], // swapper
  ],
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    await this.rateOracle.increaseObservationCardinalityNext(1000);

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("400000")
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("400000")
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("400000")
    );

    await this.e2eSetup.mintViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("10000000")
    );

    await this.e2eSetup.mintViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("10000000")
    );

    let accumulatedReserveNormalizedIncome = 1.0001;
    for (let i = 0; i < 89; i++) {
      await this.e2eSetup.swapViaAMM({
        recipient: this.positions[2][0],
        amountSpecified: toBn("-16506"),
        sqrtPriceLimitX96: encodePriceSqrt(1, 10),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
      });

      accumulatedReserveNormalizedIncome += random(0.0003, 0.0006);

      await advanceTimeAndBlock(consts.ONE_DAY.mul(4), 4);
      await this.e2eSetup.setNewRate(
        this.getRateInRay(accumulatedReserveNormalizedIncome)
      );
    }

    await advanceTimeAndBlock(this.params.duration, 10);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("analysis of historical apy", test);
