import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { randomInt } from "mathjs";
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
  skipped: true,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.exportSnapshot("START");

    const length_of_series = 50;
    const actions = [1, 2, 3];

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);

    for (let step = 0; step < length_of_series * 4; step++) {
      await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);

      const action = step < 5 ? 1 : actions[randomInt(0, actions.length)];
      await this.exportSnapshot(
        "step: " + step.toString() + " / action: " + action.toString()
      );

      if (action === 1) {
        // position mint
        const p = this.positions[randomInt(0, 5)];
        const liquidityDelta = randomInt(10000, 100000);
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        const positionMarginRequirement = await this.getMintInfoViaAMM(
          p[0],
          p[1],
          p[2],
          liquidityDeltaBn
        );

        if (positionMarginRequirement > 0) {
          await this.e2eSetup.updatePositionMarginViaAMM(
            p[0],
            p[1],
            p[2],
            toBn(positionMarginRequirement.toString())
          );
        }

        console.log(positionMarginRequirement);

        await this.e2eSetup.mintViaAMM(p[0], p[1], p[2], liquidityDeltaBn);
      }

      if (action === 2) {
        // position burn
        const p = this.positions[randomInt(0, 5)];
        const current_liquidity =
          (
            await this.marginEngineTest.callStatic.getPosition(p[0], p[1], p[2])
          )._liquidity
            .div(BigNumber.from(10).pow(12))
            .toNumber() /
          10 ** 6;
        const liquidityDelta = randomInt(0, Math.floor(current_liquidity));
        const liquidityDeltaBn = toBn(liquidityDelta.toString());

        if (liquidityDelta <= 0) continue;

        await this.e2eSetup.burnViaAMM(p[0], p[1], p[2], liquidityDeltaBn);
      }

      if (action === 3) {
        // trader swap
        const p = this.positions[randomInt(5, 8)];

        const min_vt = -Math.floor(await this.getVT("below"));
        const max_vt = Math.floor(await this.getVT("above"));
        const amount = randomInt(min_vt, max_vt);
        console.log("vt:", min_vt, "->", amount, "->", max_vt);

        const { marginRequirement: positionMarginRequirement } =
          await this.getInfoSwapViaAMM({
            recipient: p[0],
            amountSpecified: toBn(amount.toString()),
            sqrtPriceLimitX96:
              amount > 0
                ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
                : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),

            tickLower: p[1],
            tickUpper: p[2],
          });

        if (positionMarginRequirement > 0) {
          await this.e2eSetup.updatePositionMarginViaAMM(
            p[0],
            p[1],
            p[2],
            toBn(positionMarginRequirement.toString())
          );
        }

        await this.e2eSetup.swapViaAMM({
          recipient: p[0],
          amountSpecified: toBn(amount.toString()),
          sqrtPriceLimitX96:
            amount > 0
              ? await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
              : await this.testTickMath.getSqrtRatioAtTick(-5 * TICK_SPACING),

          tickLower: p[1],
          tickUpper: p[2],
        });
      }
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(90 - length_of_series), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 4);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/scenario4/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it.skip("scenario 4", test);
