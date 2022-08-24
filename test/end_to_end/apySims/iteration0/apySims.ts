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
import { e2eParameters, ScenarioRunner } from "../../general_setup/general";

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

    etaIMWad: toBn("0.002"),
    etaLMWad: toBn("0.001"),
    gap1: toBn("0"),
    gap2: toBn("0"),
    gap3: toBn("0"),
    gap4: toBn("0"),
    gap5: toBn("0"),
    gap6: toBn("0"),

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
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  // notional traded in this scenario: 1M
  NOTIONAL: BigNumber = toBn("1000000");
  override async run() {
    await this.rateOracle.increaseObservationCardinalityNext(1000);
    await this.rateOracle.increaseObservationCardinalityNext(2000);
    await this.rateOracle.increaseObservationCardinalityNext(3000);
    await this.rateOracle.increaseObservationCardinalityNext(4000);
    await this.rateOracle.increaseObservationCardinalityNext(5000);
    await this.rateOracle.increaseObservationCardinalityNext(6000);

    // list of events [timestamp in seconds, operation]
    let events: [BigNumber, () => Promise<void>][] = [];
    const days = 20;

    // current time
    let time = toBn("0");

    // accumulated Reserve Normalized Income
    let acc_rni = 1;

    // we simulate this scenario as RNI goes from 1 to 2 in one year
    const left_rni = 2 - acc_rni;

    // push all RNI updates in events
    for (let i = 0; i < days * 4; i++) {
      time = time.add(consts.ONE_HOUR.mul(6));
      const f = async () => {
        acc_rni += left_rni / 365 / 4;
        await advanceTimeAndBlock(consts.ONE_HOUR.mul(6), 1);
        await this.e2eSetup.setNewRate(this.getRateInRay(acc_rni));
      };
      events.push([time, f]);
    }

    time = consts.ONE_DAY.mul(10).add(1);

    // push mint to events
    const f = async () => {
      const positionMarginRequirement = await this.getMintInfoViaPeriphery(
        this.positions[0][0],
        {
          marginEngine: this.marginEngine.address,
          tickLower: this.positions[0][1],
          tickUpper: this.positions[0][2],
          notional: this.NOTIONAL,
          isMint: true,
          marginDelta: toBn("0"),
        }
      );

      await this.e2eSetup.mintOrBurnViaPeriphery(this.positions[0][0], {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: this.NOTIONAL,
        isMint: true,
        marginDelta: toBn(positionMarginRequirement.toString()),
      });
    };
    events.push([consts.ONE_DAY.mul(10).add(1), f]);

    // push swaps to events
    for (let i = 10; i < days; i++) {
      time = time.add(consts.ONE_DAY);

      // FULL FT and FULL VT
      const f = async () => {
        {
          const { marginRequirement } = await this.getInfoSwapViaPeriphery(
            this.positions[1][0],
            {
              marginEngine: this.marginEngine.address,
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
            marginEngine: this.marginEngine.address,
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
              marginEngine: this.marginEngine.address,
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
            marginEngine: this.marginEngine.address,
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

    // sort events list by time
    events = events.sort((a, b) => {
      if (b[0].gt(a[0])) {
        return -1;
      }
      if (a[0].gt(b[0])) {
        return 1;
      }
      return 0;
    });

    // simulate all actions
    for (let i = 0; i < events.length; i++) {
      console.log("action", i + 1, "of", events.length);
      await events[i][1]();
    }

    // advance time just to make sure the pool reaches maturity
    await advanceTimeAndBlock(consts.ONE_DAY.mul(380), 4);

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("apy simulation: iteration 0", test);
