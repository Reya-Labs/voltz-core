import { expect } from "chai";
import { ethers, waffle } from "hardhat";
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
import { e2eParametersGeneral } from "../e2eSetup";
import { ScenarioRunner } from "../newGeneral";
import { IRateOracle } from "../../../../typechain";

const { provider } = waffle;

const e2eParams: e2eParametersGeneral = {
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
  isWETH: true,
  rateOracle: 4,
};

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    await this.factory.setPeriphery(this.periphery.address);

    const otherWallet = provider.getWallets()[1];

    const rateOracleFactory = await ethers.getContractFactory("LidoRateOracle");
    const newRateOracle = (await rateOracleFactory.deploy(
      this.stETH.address,
      this.lidoOracle.address,
      this.weth.address,
      [],
      []
    )) as IRateOracle;

    expect(newRateOracle.address).to.not.be.eq(this.rateOracle.address);

    await expect(
      this.marginEngine
        .connect(otherWallet)
        .setRateOracle(newRateOracle.address)
    ).to.be.reverted;

    await this.marginEngine.setRateOracle(newRateOracle.address);

    expect(await this.marginEngine.rateOracle()).to.be.eq(
      newRateOracle.address
    );

    expect(await this.vamm.getRateOracle()).to.be.eq(this.rateOracle.address);

    await expect(this.vamm.connect(otherWallet).refreshRateOracle()).to.be
      .reverted;

    await this.vamm.refreshRateOracle();

    expect(await this.vamm.getRateOracle()).to.be.eq(newRateOracle.address);
  }
}

const test = async () => {
  console.log("Rate Oracle Setting");
  const scenario = new ScenarioRunnerInstance(e2eParams);
  await scenario.init();
  await scenario.run();
};

it("Rate Oracle Setting", test);
