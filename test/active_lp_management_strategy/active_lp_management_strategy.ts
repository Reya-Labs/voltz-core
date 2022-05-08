import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { liquidatorBotTestFixture, metaFixture } from "../shared/fixtures";
import { toBn } from "evm-bn";
import {
  ERC20Mock,
  Factory,
  MockAaveLendingPool,
  Periphery,
  TestLiquidatorBot,
  TestMarginEngine,
  TestRateOracle,
} from "../../typechain";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  TICK_SPACING,
} from "../shared/utilities";
import { advanceTimeAndBlock } from "../helpers/time";
import { consts } from "../helpers/constants";

const createFixtureLoader = waffle.createFixtureLoader;

describe("LiquidatorBot", async () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let marginEngineTest: TestMarginEngine;
  let periphery: Periphery;
  let factory: Factory;
  let aaveLendingPool: MockAaveLendingPool;
  let rateOracleTest: TestRateOracle;
  let liquidatorBotTest: TestLiquidatorBot;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, marginEngineTest, factory, aaveLendingPool, rateOracleTest } =
      await loadFixture(metaFixture));

    await token.mint(wallet.address, BigNumber.from(10).pow(27).mul(2));

    await token
      .connect(wallet)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(other.address, BigNumber.from(10).pow(27).mul(2));

    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    const margin_engine_params = {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      minDeltaLMWad: MIN_DELTA_LM,
      minDeltaIMWad: MIN_DELTA_IM,
      sigmaSquaredWad: SIGMA_SQUARED,
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
      minMarginToIncentiviseLiquidators: 0,
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    await marginEngineTest.setLookbackWindowInSeconds(consts.ONE_DAY);

    // deploy the periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");

    periphery = (await peripheryFactory.deploy()) as Periphery;

    // set the periphery in the factory
    await expect(factory.setPeriphery(periphery.address))
      .to.emit(factory, "PeripheryUpdate")
      .withArgs(periphery.address);

    // approve the periphery to spend tokens on wallet's behalf

    await token
      .connect(wallet)
      .approve(periphery.address, BigNumber.from(10).pow(27));

    await token
      .connect(other)
      .approve(periphery.address, BigNumber.from(10).pow(27));
  });

  it("active lp management strategy", async () => {

    // other deposits margin into the lp vault
    

    // liquidity gets traded left <-> right (ft followed by vt)

    // fees get generated

    // rebalance

    // market conditions have changed, and now liquidity is traded right <-> left (vt followed by ft)

    // fees get generated

    // withdraw

    // calculate the apy?

  });
});
