import { BigNumber, utils } from "ethers";
import { toBn } from "evm-bn";
import { random } from "mathjs";
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
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { e2eParameters } from "../e2eSetup";
import { ScenarioRunner } from "../general";

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
    [0, -TICK_SPACING, TICK_SPACING],
    [1, -3 * TICK_SPACING, -TICK_SPACING],
    [2, -TICK_SPACING, TICK_SPACING],
    [3, -TICK_SPACING, TICK_SPACING],
  ],
  skipped: true,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.marginEngineTest.setLiquidatorReward(toBn("0.1"));
    await this.exportSnapshot("START");

    // update the position margin with 210
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("210")
    );

    // add 1,000,000 liquidity to Position 0
    await this.e2eSetup.mintViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );

    // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
    await this.exportSnapshot("BEFORE FIRST SWAP");

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("1000")
    );

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.getVT("below");

    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-1000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    let accumulatedReserveNormalizedIncome = 1.0001;
    for (let i = 0; i < 89; i++) {
      await this.exportSnapshot("step " + i.toString());

      accumulatedReserveNormalizedIncome += random(0.0005, 0.0015);
      await this.advanceAndUpdateApy(
        consts.ONE_DAY,
        1,
        accumulatedReserveNormalizedIncome
      );
      await this.updateAPYbounds();
      console.log("historical apy:", utils.formatEther(this.historicalApyWad));
      console.log(
        "variable factor:",
        utils.formatEther(this.variableFactorWad)
      );

      try {
        await this.e2eSetup.liquidatePosition(
          this.positions[3][0],
          this.positions[3][1],
          this.positions[3][2],
          this.positions[0][0],
          this.positions[0][1],
          this.positions[0][2]
        );
        console.log("is liquidatable");
        break;
      } catch (_) {}
    }

    await this.exportSnapshot("AFTER LIQUIDATION TRIAL");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90), 2);

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 7);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario7/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 7", test);
