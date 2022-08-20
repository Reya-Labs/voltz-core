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

    etaIMWad: toBn("0.002"),
    etaLMWad: toBn("0.001"),

    gammaWad: toBn("1.0"),
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
    [2, -TICK_SPACING, TICK_SPACING],
    [3, -TICK_SPACING, TICK_SPACING],
  ],
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    // update the position margin with 210
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("420")
    );

    // add 1,000,000 liquidity to Position 0
    await this.e2eSetup.mintViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );

    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0081));

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[2][0],
      this.positions[2][1],
      this.positions[2][2],
      toBn("2000")
    );

    // Trader 0 buys 2,995 VT
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[2][0],
      amountSpecified: toBn("-2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: this.positions[2][1],
      tickUpper: this.positions[2][2],
    });

    await advanceTimeAndBlock(consts.ONE_WEEK, 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0081));

    // add 5,000,000 liquidity to Position 1

    // update the position margin with 2,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("4000")
    );

    // add 5,000,000 liquidity to Position 1
    await this.e2eSetup.mintViaAMM(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("5000000")
    );

    await advanceTimeAndBlock(consts.ONE_WEEK, 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0125));

    // update the trader margin with 1,000
    await this.e2eSetup.updatePositionMarginViaAMM(
      this.positions[3][0],
      this.positions[3][1],
      this.positions[3][2],
      toBn("2000")
    );

    // Trader 1 buys 15,000 VT
    await this.e2eSetup.swapViaAMM({
      recipient: this.positions[3][0],
      amountSpecified: toBn("-15000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: this.positions[3][1],
      tickUpper: this.positions[3][2],
    });

    // Trader 0 sells 10,000 VT
    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      this.positions[2][0],
      toBn("10000"),
      BigNumber.from(MAX_SQRT_RATIO.sub(1))
    );

    await this.e2eSetup.unwindFullyCollateralisedFixedTakerSwap(
      this.positions[2][0],
      toBn("10000"),
      BigNumber.from(MIN_SQRT_RATIO.add(1))
    );

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(2), 2);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.013));

    // burn all liquidity of Position 0
    await this.e2eSetup.burnViaAMM(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(8), 4);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0132));

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

it("series of transactions", test);
