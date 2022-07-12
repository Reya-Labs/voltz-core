import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  encodeSqrtRatioX96,
  MAX_SQRT_RATIO,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { ScenarioRunner, e2eParameters } from "../general";

const e2eParams: e2eParameters = {
  duration: consts.ONE_MONTH.mul(3),
  numActors: 4,
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
    [0, -TICK_SPACING * 300, -TICK_SPACING * 299],
    [1, -TICK_SPACING * 300, -TICK_SPACING * 299],
    [2, -TICK_SPACING, TICK_SPACING],
    [3, -TICK_SPACING, TICK_SPACING],
  ],
  rateOracle: 1,
};

// TODO: put all margin requirements into a file (and ignore it in git)

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("21000")
    );

    await this.e2eSetup.mintViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("100000000")
    );

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("1000")
    );

    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-2000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[3][0],
      this.positions[3][1],
      this.positions[3][2],
      toBn("1000")
    );

    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[3][0],
      amountSpecified: toBn("2000"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),

      tickLower: this.positions[3][1],
      tickUpper: this.positions[3][2],
    });

    for (let i = 0; i < 89; i++) {
      await advanceTimeAndBlock(consts.ONE_DAY.mul(1), 1);
      await this.e2eSetup.setNewRate(this.getRateInRay(1.001 + i * 0.0001));
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(40), 1);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("90 days of simulating rate", test);
