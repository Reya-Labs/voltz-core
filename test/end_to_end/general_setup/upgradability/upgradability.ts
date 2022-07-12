import { waffle, ethers } from "hardhat";
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
  MIN_SQRT_RATIO,
  TICK_SPACING,
  T_MAX,
  XI_LOWER,
  XI_UPPER,
} from "../../../shared/utilities";
import { e2eParametersGeneral } from "../e2eSetup";
import { ScenarioRunner } from "../newGeneral";
import { MarginEngineEmergency } from "../../../../typechain/MarginEngineEmergency";
import { BigNumber } from "ethers";
import { expect } from "../../../shared/expect";
import { MarginEngine, TestMarginEngine } from "../../../../typechain";

const { provider } = waffle;

const e2eParams: e2eParametersGeneral = {
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
  feeProtocol: 0,
  fee: toBn("0"),
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
    await this.vamm.initializeVAMM(this.params.startingPrice.toString());
    const otherWallet = provider.getWallets()[1];

    console.log("owner address:", this.owner.address);
    console.log("other address:", otherWallet.address);

    await this.mintAndApprove(this.owner.address, BigNumber.from(10).pow(27));
    await this.token.approve(
      this.marginEngine.address,
      BigNumber.from(10).pow(27)
    );

    await this.mintAndApprove(otherWallet.address, BigNumber.from(10).pow(27));
    await this.token
      .connect(otherWallet)
      .approve(this.marginEngine.address, BigNumber.from(10).pow(27));

    const initOwnerBalance = await this.token.balanceOf(this.owner.address);
    const initOtherBalance = await this.token.balanceOf(otherWallet.address);
    const initMEBalance = await this.token.balanceOf(this.marginEngine.address);

    await this.marginEngine.updatePositionMargin(
      this.owner.address,
      -this.params.tickSpacing,
      this.params.tickSpacing,
      toBn("210")
    );

    await this.vamm.mint(
      this.owner.address,
      -this.params.tickSpacing,
      this.params.tickSpacing,
      toBn("1000000")
    );

    await this.marginEngine
      .connect(otherWallet)
      .updatePositionMargin(
        otherWallet.address,
        -this.params.tickSpacing,
        this.params.tickSpacing,
        toBn("1000")
      );

    await this.vamm.connect(otherWallet).swap({
      recipient: otherWallet.address,
      amountSpecified: toBn("-15000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      tickLower: -this.params.tickSpacing,
      tickUpper: this.params.tickSpacing,
    });

    expect(await this.token.balanceOf(this.owner.address)).to.be.eq(
      initOwnerBalance.sub(toBn("210"))
    );

    expect(await this.token.balanceOf(otherWallet.address)).to.be.eq(
      initOtherBalance.sub(toBn("1000"))
    );

    expect(await this.token.balanceOf(this.marginEngine.address)).to.be.eq(
      initMEBalance.add(toBn("1210"))
    );

    // old storage
    const liquidatorRewardBefore =
      await this.marginEngine.liquidatorRewardWad();

    const underlyingTokenBefore = await this.marginEngine.underlyingToken();

    const termStartTimestampBefore =
      await this.marginEngine.termStartTimestampWad();

    const termEndTimestampBefore =
      await this.marginEngine.termEndTimestampWad();

    const fcmBefore = await this.marginEngine.fcm();

    const vammBefore = await this.marginEngine.vamm();

    const rateOracleBefore = await this.marginEngine.rateOracle();

    const factoryBefore = await this.marginEngine.factory();

    const secondsAgoBefore = await this.marginEngine.lookbackWindowInSeconds();

    const isAlphaBefore = await this.marginEngine.isAlpha();

    const ownerBefore = await (this.marginEngine as TestMarginEngine).owner();

    const cacheMaxAgeInSecondsBefore =
      await this.marginEngine.cacheMaxAgeInSeconds();

    // upgrade

    const marginEngineEmergencyMasterFactory = await ethers.getContractFactory(
      "MarginEngineEmergency"
    );
    const marginEngineEmergencyMaster =
      (await marginEngineEmergencyMasterFactory.deploy()) as MarginEngineEmergency;

    await expect(
      (this.marginEngine as MarginEngine)
        .connect(otherWallet)
        .upgradeTo(marginEngineEmergencyMaster.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await (this.marginEngine as MarginEngine).upgradeTo(
      marginEngineEmergencyMaster.address
    );

    const marginEngineEmergency = marginEngineEmergencyMasterFactory.attach(
      this.marginEngine.address
    ) as MarginEngineEmergency;

    // is owner preserved?
    expect(await marginEngineEmergency.owner()).to.be.eq(this.owner.address);

    // does the new functionality work?
    await marginEngineEmergency.emergencyWithdrawal(
      this.owner.address,
      -this.params.tickSpacing,
      this.params.tickSpacing
    );

    await marginEngineEmergency
      .connect(otherWallet)
      .emergencyWithdrawal(
        otherWallet.address,
        -this.params.tickSpacing,
        this.params.tickSpacing
      );

    expect(await this.token.balanceOf(this.owner.address)).to.be.eq(
      initOwnerBalance
    );

    expect(await this.token.balanceOf(otherWallet.address)).to.be.eq(
      initOtherBalance
    );

    expect(await this.token.balanceOf(this.marginEngine.address)).to.be.eq(
      initMEBalance
    );

    // check new storage
    expect(await marginEngineEmergency.liquidatorRewardWad()).to.be.eq(
      liquidatorRewardBefore
    );

    expect(await marginEngineEmergency.underlyingToken()).to.be.eq(
      underlyingTokenBefore
    );

    expect(await marginEngineEmergency.termStartTimestampWad()).to.be.eq(
      termStartTimestampBefore
    );

    expect(await marginEngineEmergency.termEndTimestampWad()).to.be.eq(
      termEndTimestampBefore
    );

    expect(await marginEngineEmergency.fcm()).to.be.eq(fcmBefore);

    expect(await marginEngineEmergency.vamm()).to.be.eq(vammBefore);

    expect(await marginEngineEmergency.rateOracle()).to.be.eq(rateOracleBefore);

    expect(await marginEngineEmergency.factory()).to.be.eq(factoryBefore);

    expect(await marginEngineEmergency.lookbackWindowInSeconds()).to.be.eq(
      secondsAgoBefore
    );

    expect(await marginEngineEmergency.isAlpha()).to.be.eq(isAlphaBefore);

    expect(await marginEngineEmergency.owner()).to.be.eq(ownerBefore);

    expect(await marginEngineEmergency.cacheMaxAgeInSeconds()).to.be.eq(
      cacheMaxAgeInSecondsBefore
    );

    expect(await marginEngineEmergency.liquidatorRewardWad()).to.be.eq(
      liquidatorRewardBefore
    );
  }
}

const test = async () => {
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("upgradability", test);
