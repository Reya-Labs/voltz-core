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
    gap1: toBn("0"),
    gap2: toBn("0"),
    gap3: toBn("0"),
    gap4: toBn("0"),
    gap5: toBn("0"),
    gap6: toBn("0"),
    gap7: toBn("0"),

    minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
  },
  lookBackWindowAPY: consts.ONE_MONTH.mul(3),
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
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: toBn("6000"),
        isMint: true,
        marginDelta: toBn("210"),
      };

      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[0][0],
        mintOrBurnParameters
      );
    }

    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.0081));

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: true,
        notional: toBn("2995"),
        // sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: toBn("1000"),
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters
      );
    }

    await advanceTimeAndBlock(consts.ONE_WEEK, 2);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.01));

    // add 5,000,000 liquidity to Position 1

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(4), 4);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.04));

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(4), 4);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.05));

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(2), 4);
    await this.e2eSetup.setNewRate(this.getRateInRay(1.06));

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

it("checking historical apy", test);
