import { expect } from "chai";
import { waffle } from "hardhat";
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

const { provider } = waffle;

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

    await this.factory.setPeriphery(this.periphery.address);

    const otherWallet = provider.getWallets()[1];

    await expect(this.vammTest.connect(otherWallet).setIsAlpha(true)).to.be
      .reverted;

    await expect(this.marginEngineTest.connect(otherWallet).setIsAlpha(true)).to
      .be.reverted;

    await expect(
      this.periphery
        .connect(otherWallet)
        .setLPMarginCap(this.vammTest.address, toBn("1000"))
    ).to.be.reverted;

    await this.vammTest.setIsAlpha(true);
    await this.marginEngineTest.setIsAlpha(true);
    await this.periphery.setLPMarginCap(this.vammTest.address, toBn("1000"));

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngineTest.address,
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

    expect(
      await this.periphery.lpMarginCumulatives(this.vammTest.address)
    ).to.be.equal(toBn("210"));

    // two days pass and set reserve normalised income
    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days

    // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
    await this.exportSnapshot("BEFORE FIRST SWAP");

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngineTest.address,
        isFT: false,
        notional: toBn("2995"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[2][1],
        tickUpper: this.positions[2][2],
        marginDelta: toBn("1000"),
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[2][0],
        swapParameters
      );
    }

    await this.exportSnapshot("AFTER FIRST SWAP");

    await this.updateCurrentTick();

    // one week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);

    // add 5,000,000 liquidity to Position 1

    // print the position margin requirement
    // await this.getAPYboundsAndPositionMargin(this.positions[1]);

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngineTest.address,
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        notional: toBn("30000"),
        isMint: true,
        marginDelta: toBn("2500"),
      };

      // add 1,000,000 liquidity to Position 0
      await expect(
        this.e2eSetup.mintOrBurnViaPeriphery(
          this.positions[1][0],
          mintOrBurnParameters
        )
      ).to.be.revertedWith("lp cap limit");

      await this.periphery.setLPMarginCap(this.vammTest.address, toBn("3000"));

      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[1][0],
        mintOrBurnParameters
      );

      expect(
        await this.periphery.lpMarginCumulatives(this.vammTest.address)
      ).to.be.equal(toBn("2710"));
    }

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngineTest.address,
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        notional: toBn("30000"),
        isMint: true,
        marginDelta: toBn("2500"),
      };

      // add 1,000,000 liquidity to Position 0
      await expect(
        this.e2eSetup.mintOrBurnViaPeriphery(
          this.positions[1][0],
          mintOrBurnParameters
        )
      ).to.be.revertedWith("lp cap limit");

      await this.vammTest.setIsAlpha(false);
      await this.marginEngineTest.setIsAlpha(false);

      await this.e2eSetup.mintOrBurnViaPeriphery(
        this.positions[1][0],
        mintOrBurnParameters
      );

      expect(
        await this.periphery.lpMarginCumulatives(this.vammTest.address)
      ).to.be.equal(toBn("2710"));
    }

    // a week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125);

    // Trader 1 engages in a swap
    await this.exportSnapshot("BEFORE SECOND SWAP");

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngineTest.address,
        isFT: false,
        notional: toBn("15000"),
        sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
        tickLower: this.positions[3][1],
        tickUpper: this.positions[3][2],
        marginDelta: toBn("1000"),
      };
      await this.e2eSetup.swapViaPeriphery(
        this.positions[3][0],
        swapParameters
      );
    }

    await this.exportSnapshot("AFTER SECOND SWAP");

    // Trader 0 engages in a reverse swap
    await this.exportSnapshot("BEFORE THIRD (REVERSE) SWAP");

    {
      // Trader 0 buys 2,995 VT
      const swapParameters = {
        marginEngine: this.marginEngineTest.address,
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

    await this.exportSnapshot("AFTER THIRD (REVERSE) SWAP");

    await this.updateCurrentTick();

    // two weeks pass
    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(2), 2, 1.013); // advance two weeks

    {
      const mintOrBurnParameters = {
        marginEngine: this.marginEngineTest.address,
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

    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)

    await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

    // settle positions and traders
    // await this.settlePositions();

    await this.exportSnapshot("FINAL");
  }
}

const test = async () => {
  console.log("LP Margin Cap");
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/lpMarginCap/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it("LP Margin Cap", test);
