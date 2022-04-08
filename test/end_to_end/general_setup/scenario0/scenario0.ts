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
  skipped: false,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    // add 1,000,000 liquidity to Position 0

    // print the position margin requirement
    // await this.getAPYboundsAndPositionMargin(this.positions[0]);

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

    // two days pass and set reserve normalised income
    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days

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

    // Trader 0 buys 2,995 VT
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    await this.exportSnapshot("AFTER FIRST SWAP");

    await this.updateCurrentTick();

    // one week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);

    // add 5,000,000 liquidity to Position 1

    // print the position margin requirement
    // await this.getAPYboundsAndPositionMargin(this.positions[1]);

    // update the position margin with 2,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("2100")
    );

    // add 5,000,000 liquidity to Position 1
    await this.e2eSetup.mintViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("5000000")
    );

    // a week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125);

    // Trader 1 engages in a swap
    await this.exportSnapshot("BEFORE SECOND SWAP");

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[3][0],
      this.positions[3][1],
      this.positions[3][2],
      toBn("1000")
    );

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.getVT("below");

    // Trader 1 buys 15,000 VT
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[3][0],
      amountSpecified: toBn("-15000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),

      tickLower: this.positions[3][1],
      tickUpper: this.positions[3][2],
    });
    await this.exportSnapshot("AFTER SECOND SWAP");

    // Trader 0 engages in a reverse swap
    await this.exportSnapshot("BEFORE THIRD (REVERSE) SWAP");

    // Trader 0 sells 10,000 VT
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[2][0],
      amountSpecified: toBn("10000"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),

      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    await this.exportSnapshot("AFTER THIRD (REVERSE) SWAP");

    await this.updateCurrentTick();

    // two weeks pass
    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(2), 2, 1.013); // advance two weeks

    // burn all liquidity of Position 0
    await this.e2eSetup.burnViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );

    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)

    await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 0);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario0/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 0", test);
