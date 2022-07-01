import { BigNumber, ethers } from "ethers";
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
import { ScenarioRunner } from "../newGeneral";

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
  isWETH: true,
  noMintTokens: true,
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
        marginDelta: toBn("0"),
      };

      const tempOverrides = {
        value: ethers.utils.parseEther("210"),
      };

      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[0][0],
        mintOrBurnParameters,
        tempOverrides
      );
    }

    // two days pass and set reserve normalised income
    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1);

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: false,
        notional: toBn("2995"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: toBn("0"),
      };

      const tempOverrides = {
        value: ethers.utils.parseEther("1000"),
      };

      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters,
        tempOverrides
      );
    }

    // add 5,000,000 liquidity to Position 1

    // print the position margin requirement
    // await this.getAPYboundsAndPositionMargin(this.positions[1]);

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        notional: toBn("30000"),
        isMint: true,
        marginDelta: toBn("0"),
      };

      const tempOverrides = {
        value: ethers.utils.parseEther("2500"),
      };

      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[1][0],
        mintOrBurnParameters,
        tempOverrides
      );
    }

    // a week passes
    await advanceTimeAndBlock(consts.ONE_WEEK, 2);

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: false,
        notional: toBn("15000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[3][1],
        tickUpper: this.positions[3][2],
        marginDelta: toBn("0"),
      };

      const tempOverrides = {
        value: ethers.utils.parseEther("1000"),
      };

      await this.e2eSetup.swapViaPeriphery(
        this.positions[3][0],
        swapParameters,
        tempOverrides
      );
    }

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngine.address,
        isFT: true,
        notional: toBn("10000"),
        sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: toBn("0"),
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters
      );
    }

    // two weeks pass
    await advanceTimeAndBlock(consts.ONE_WEEK.mul(2), 2); // advance two weeks

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngine.address,
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        notional: toBn("2995.35"),
        isMint: false,
        marginDelta: toBn("0"),
      };

      // add 1,000,000 liquidity to Position 0
      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[0][0],
        mintOrBurnParameters
      );
    }

    await advanceTimeAndBlock(consts.ONE_WEEK.mul(9), 4); // advance eight weeks (4 days before maturity)

    const apy = await this.marginEngine.callStatic.getHistoricalApy();
    console.log("apy:", ethers.utils.parseEther(apy.toString()));

    await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositions();
  }
}

const test = async () => {
  console.log("scenario weth");
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/weth/consoleViaPeriphery.txt"
  );
  await scenario.init();
  await scenario.run();
};

it("scenario weth", test);
