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
import { ScenarioRunner, e2eParameters } from "../general";
import { expect } from "chai";
import { VAMM } from "../../../../typechain";

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
  rateOracle: 1,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.rateOracle.increaseObservationCardinalityNext(1000);
    await this.rateOracle.increaseObservationCardinalityNext(2000);

    await this.vamm.initializeVAMM(this.params.startingPrice.toString());

    const otherWallet = provider.getWallets()[1];
    console.log("wallets:", this.owner.address, otherWallet.address);

    // wallet with no permission cannot pause the contracts
    await expect(this.vamm.connect(otherWallet).setPausability(true)).to.be
      .reverted;

    // wallet with permission can pause/unpause the contracts
    await (this.vamm as VAMM).changePauser(otherWallet.address, true);

    expect(await (this.vamm as VAMM).paused()).to.be.equal(false);
    await this.vamm.connect(otherWallet).setPausability(true);
    expect(await (this.vamm as VAMM).paused()).to.be.equal(true);
    await this.vamm.connect(otherWallet).setPausability(false);
    expect(await (this.vamm as VAMM).paused()).to.be.equal(false);

    // check the revoke/grant functionality
    await (this.vamm as VAMM).changePauser(otherWallet.address, false);
    await expect(this.vamm.setPausability(true)).to.be.reverted;
    await (this.vamm as VAMM).changePauser(otherWallet.address, true);

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

    await this.vamm.connect(otherWallet).setPausability(true);

    // it shouldn't work because VAMM is paused
    await expect(
      this.e2eSetup.mintViaAMM(p[0], p[1], p[2], liquidityDeltaBn)
    ).to.be.revertedWith("Paused");

    await expect(
      this.e2eSetup.updatePositionMarginViaAMM(p[0], p[1], p[2], toBn("10000"))
    ).to.be.reverted;

    // pause the Margin Engine as well
    await expect(this.marginEngine.connect(otherWallet).setPausability(true)).to
      .be.reverted;

    await expect(
      this.e2eSetup.updatePositionMarginViaAMM(p[0], p[1], p[2], toBn("10000"))
    ).to.be.revertedWith("Paused");

    // unpause both VAMM and Margin Engine
    await this.vamm.connect(otherWallet).setPausability(false);
    await expect(this.marginEngine.connect(otherWallet).setPausability(false))
      .to.be.reverted;

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
      await this.tickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );

    // pause the FCM
    await this.vamm.connect(otherWallet).setPausability(true);

    if (this.fcm) {
      await expect(this.fcm.connect(otherWallet).setPausability(true)).to.be
        .reverted;
    }

    await expect(
      this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
        p[0],
        toBn("100"),
        await this.tickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
      )
    ).to.be.revertedWith("Paused");

    // unpause the FCM
    if (this.fcm) {
      await expect(this.fcm.connect(otherWallet).setPausability(false)).to.be
        .reverted;
    }
    await this.vamm.connect(otherWallet).setPausability(false);

    await this.e2eSetup.initiateFullyCollateralisedFixedTakerSwap(
      p[0],
      toBn("100"),
      await this.tickMath.getSqrtRatioAtTick(5 * TICK_SPACING)
    );
  }
}

const test = async () => {
  console.log("pausability");
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("pausability", test);
