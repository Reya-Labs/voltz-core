import { utils } from "ethers";
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
import { e2eParameters } from "../e2eSetup";
import { ScenarioRunner } from "../general";

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
  skipped: true,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);

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

    await this.exportSnapshot("available amounts");

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
      await this.advanceAndUpdateApy(
        consts.ONE_DAY.mul(4),
        4,
        accumulatedReserveNormalizedIncome
      );
      await this.updateAPYbounds();
      console.log(" historical apy:", utils.formatEther(this.historicalApyWad));
      console.log(
        "variable factor:",
        utils.formatEther(this.variableFactorWad)
      );

      await this.exportSnapshot("AFTER step " + i.toString());
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(15), 10);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 6);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario6/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 6", test);
