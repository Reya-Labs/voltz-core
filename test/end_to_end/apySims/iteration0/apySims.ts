import { BigNumber } from "ethers";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
import { advanceTimeAndBlock } from "../../../helpers/time";
import { TickMath } from "../../../shared/tickMath";
import {
  ALPHA,
  APY_LOWER_MULTIPLIER,
  APY_UPPER_MULTIPLIER,
  BETA,
  MIN_DELTA_IM,
  MIN_DELTA_LM,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { e2eParameters } from "../../general_setup/e2eSetup";
import { ScenarioRunner } from "../../general_setup/general";

const e2eParams: e2eParameters = {
  duration: consts.ONE_YEAR,
  numActors: 2,
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

    gammaWad: toBn("0.05"),
    minMarginToIncentiviseLiquidators: 0,
  },
  lookBackWindowAPY: consts.ONE_WEEK,
  startingPrice: TickMath.getSqrtRatioAtTick(-24840),
  feeProtocol: 0,
  fee: toBn("0.0005"),
  tickSpacing: TICK_SPACING,
  positions: [
    // lower tick: 8% -> 1.0001^(UPPER_TICK) = price = 1/(fixed rate), if fixed rate is 8%, 1.0001^(UPPER_TICK)=1/8 => UPPER_TICK approx. = -20795
    // upper tick: 12% -> if fixed rate is 12%, 1.0001^(UPPER_TICK)=1/12 => UPPER_TICK approx. = -24850
    [0, -24840, -20700],
    [1, -24840, -20700],
  ],
  skipped: true,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario\
  // 1M of notional
  NOTIONAL: BigNumber = toBn("1000000");
  override async run() {
    await this.exportSnapshot("START");

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);
    await this.rateOracleTest.increaseObservationCardinalityNext(3000);
    await this.rateOracleTest.increaseObservationCardinalityNext(4000);
    await this.rateOracleTest.increaseObservationCardinalityNext(5000);
    await this.rateOracleTest.increaseObservationCardinalityNext(6000);

    let events: [BigNumber, () => Promise<void>][] = [];
    const days = 20;

    let time = toBn("0");
    let acc_rni = 1;
    const left_rni = 2 - acc_rni;

    for (let i = 0; i < days * 4; i++) {
      time = time.add(consts.ONE_HOUR.mul(6));
      const f = async () => {
        acc_rni += left_rni / 365 / 4;
        await this.advanceAndUpdateApy(consts.ONE_HOUR.mul(6), 1, acc_rni);
      };
      events.push([time, f]);
    }

    time = consts.ONE_DAY.mul(10).add(1);

    const f = async () => {
      const positionMarginRequirement = await this.getMintInfoViaPeriphery(
        this.positions[0][0],
        {
          marginEngine: this.marginEngineTest.address,
          tickLower: this.positions[0][1],
          tickUpper: this.positions[0][2],
          notional: this.NOTIONAL,
          isMint: true,
          marginDelta: toBn("0"),
        }
      );

      await this.e2eSetup.mintOrBurnViaPeriphery(this.positions[0][0], {
        marginEngine: this.marginEngineTest.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: this.NOTIONAL,
        isMint: true,
        marginDelta: toBn(positionMarginRequirement.toString()),
      });
    };
    events.push([consts.ONE_DAY.mul(10).add(1), f]);

    for (let i = 10; i < days; i++) {
      time = time.add(consts.ONE_DAY);
      const f = async () => {
        {
          const { marginRequirement } = await this.getInfoSwapViaPeriphery(
            this.positions[1][0],
            {
              marginEngine: this.marginEngineTest.address,
              isFT: true,
              notional: this.NOTIONAL,
              sqrtPriceLimitX96: BigNumber.from(
                TickMath.getSqrtRatioAtTick(this.positions[0][2]).toString()
              ),
              tickLower: this.positions[1][1],
              tickUpper: this.positions[1][2],
              marginDelta: toBn("0"),
            }
          );

          await this.e2eSetup.swapViaPeriphery(this.positions[1][0], {
            marginEngine: this.marginEngineTest.address,
            isFT: true,
            notional: this.NOTIONAL,
            sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(
              this.positions[0][2]
            ).toString(),
            tickLower: this.positions[1][1],
            tickUpper: this.positions[1][2],
            marginDelta: toBn(marginRequirement.toString()),
          });
        }
        {
          const { marginRequirement } = await this.getInfoSwapViaPeriphery(
            this.positions[1][0],
            {
              marginEngine: this.marginEngineTest.address,
              isFT: false,
              notional: this.NOTIONAL,
              sqrtPriceLimitX96: BigNumber.from(
                TickMath.getSqrtRatioAtTick(this.positions[0][1]).toString()
              ),
              tickLower: this.positions[1][1],
              tickUpper: this.positions[1][2],
              marginDelta: toBn("0"),
            }
          );

          await this.e2eSetup.swapViaPeriphery(this.positions[1][0], {
            marginEngine: this.marginEngineTest.address,
            isFT: false,
            notional: this.NOTIONAL,
            sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(
              this.positions[0][1]
            ).toString(),
            tickLower: this.positions[1][1],
            tickUpper: this.positions[1][2],
            marginDelta: toBn(marginRequirement.toString()),
          });
        }
      };
      events.push([time, f]);
    }

    events = events.sort((a, b) => {
      if (b[0].gt(a[0])) {
        return -1;
      }
      if (a[0].gt(b[0])) {
        return 1;
      }
      return 0;
    });

    for (let i = 0; i < events.length; i++) {
      console.log("action", i + 1, "of", events.length);
      await events[i][1]();
      await this.exportSnapshot("step " + (i + 1).toString());
    }

    // export snapshot before settlement
    await this.exportSnapshot("BEFORE SETTLEMENT");

    await advanceTimeAndBlock(consts.ONE_DAY.mul(380), 4);

    // settle positions and traders
    await this.settlePositions();
    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("scenario", 12);
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/apySims/iteration0/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it("scenario 12 (apy sims)", test);
