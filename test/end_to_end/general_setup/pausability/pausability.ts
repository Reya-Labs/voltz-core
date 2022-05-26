import { waffle } from "hardhat";
import { toBn } from "evm-bn";
import { consts } from "../../../helpers/constants";
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
import { expect } from "chai";

const { provider } = waffle;

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

    await this.rateOracleTest.increaseObservationCardinalityNext(1000);
    await this.rateOracleTest.increaseObservationCardinalityNext(2000);

    const otherWallet = provider.getWallets()[1];
    console.log("wallets:", this.owner.address, otherWallet.address);

    // wallet with no permission cannot pause the contracts
    await expect(this.vammTest.connect(otherWallet).pause()).to.be.reverted;

    // wallet with permission can pause/unpause the contracts
    await this.vammTest.grantPauser(otherWallet.address);

    expect(await this.vammTest.paused()).to.be.equal(false);
    await this.vammTest.connect(otherWallet).pause();
    expect(await this.vammTest.paused()).to.be.equal(true);
    await this.vammTest.connect(otherWallet).unpause();
    expect(await this.vammTest.paused()).to.be.equal(false);

    // check the revoke/grant functionality
    await this.vammTest.revokePauser(otherWallet.address);
    await expect(this.vammTest.pause()).to.be.reverted;
    await this.vammTest.grantPauser(otherWallet.address);

    // check if operations work when contracts not paused
    const p = this.positions[0];

    await this.e2eSetup.updatePositionMarginViaAMM(
      p[0],
      p[1],
      p[2],
      toBn("10000")
    );

    const liquidityDeltaBn = toBn("1000000");

    await this.e2eSetup.mintViaAMM(p[0], p[1], p[2], liquidityDeltaBn);

    await this.vammTest.connect(otherWallet).pause();

    // it shouldn't work because VAMM is paused
    await expect(
      this.e2eSetup.mintViaAMM(p[0], p[1], p[2], liquidityDeltaBn)
    ).to.be.revertedWith("Pausable: paused");

    // it should still work because the Margin Engine is not paused yet
    await this.e2eSetup.updatePositionMarginViaAMM(
      p[0],
      p[1],
      p[2],
      toBn("10000")
    );

    // pause the Margin Engine as well
    await this.marginEngineTest.grantPauser(otherWallet.address);
    await this.marginEngineTest.connect(otherWallet).pause();

    await expect(
      this.e2eSetup.updatePositionMarginViaAMM(p[0], p[1], p[2], toBn("10000"))
    ).to.be.revertedWith("Pausable: paused");

    // unpause both VAMM and Margin Engine
    await this.vammTest.connect(otherWallet).unpause();
    await this.marginEngineTest.connect(otherWallet).unpause();

    await this.e2eSetup.updatePositionMarginViaAMM(
      p[0],
      p[1],
      p[2],
      toBn("10000")
    );

    await this.e2eSetup.mintViaAMM(p[0], p[1], p[2], liquidityDeltaBn);

    // check if FCM works when unpaused
    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      p[0],
      toBn("100"),
      await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );

    // pause the FCM
    await this.fcmTest.grantPauser(otherWallet.address);
    await this.fcmTest.connect(otherWallet).pause();

    await expect(
      this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
        p[0],
        toBn("100"),
        await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
      )
    ).to.be.revertedWith("Pausable: paused");

    // unpause the FCM
    await this.fcmTest.connect(otherWallet).unpause();

    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      p[0],
      toBn("100"),
      await this.testTickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );
  }
}

const test = async () => {
  console.log("pausability");
  const scenario = new ScenarioRunnerInstance(
    e2eParams,
    "test/end_to_end/general_setup/pausability/console.txt"
  );
  await scenario.init();
  await scenario.run();
};

it("pausability", test);