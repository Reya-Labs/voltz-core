import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import {
  activeLPManagementStrategyTestFixture,
  metaFixture,
} from "../shared/fixtures";
import { toBn } from "evm-bn";
import {
  ERC20Mock,
  Factory,
  Periphery,
  TestActiveLPManagementStrategy,
  TestMarginEngine,
  TestVAMM,
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
import { consts } from "../helpers/constants";
import { TickMath } from "../shared/tickMath";

const createFixtureLoader = waffle.createFixtureLoader;

describe("Active LP Management Strategy", async () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let marginEngineTest: TestMarginEngine;
  let vammTest: TestVAMM;
  let periphery: Periphery;
  let factory: Factory;
  let activeLPManagementStrategyTest: TestActiveLPManagementStrategy;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({ token, marginEngineTest, vammTest, factory } = await loadFixture(
      metaFixture
    ));

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

    await marginEngineTest.setLookbackWindowInSeconds(consts.ONE_DAY.div(4)); // 6 hours

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
    // initialize vamm at -TICK_SPACING
    await vammTest.initializeVAMM(
      TickMath.getSqrtRatioAtTick(-TICK_SPACING).toString()
    );

    // set fee parameter
    await vammTest.setFee(toBn("0.01"));

    // starting tick range
    const startingTickLower = -TICK_SPACING;
    const startingTickUpper = 0;

    // updated tick range
    const updatedTickLower = -(TICK_SPACING * 2);
    const updatedTickUpper = -TICK_SPACING;

    // in underlying tokens (e.g. DAI)
    const lpDepositAmount = BigNumber.from(10).pow(18).mul(500); // 18 decimals
    console.log(
      "deposit amount ",
      utils.formatEther(lpDepositAmount.toString()),
      " VUSD"
    );

    // deploy the lp optimizer smart contract
    ({ activeLPManagementStrategyTest } = await loadFixture(
      activeLPManagementStrategyTestFixture
    ));

    // set margin engine and vamm in the lp optimizer
    // marginEngineTest refers to a test margin engine for a given IRS pool
    // periphery refers to the Voltz Periphery contract which abstracts away the complexities of interactive with the voltz core directly
    await activeLPManagementStrategyTest.setMarginEngineAndVAMM(
      marginEngineTest.address,
      periphery.address
    );

    // checks
    expect(await activeLPManagementStrategyTest.underlyingToken()).to.eq(
      token.address
    );
    expect(await activeLPManagementStrategyTest.marginEngine()).to.eq(
      marginEngineTest.address
    );
    expect(await activeLPManagementStrategyTest.vamm()).to.eq(
      await marginEngineTest.vamm()
    );
    expect(await activeLPManagementStrategyTest.periphery()).to.eq(
      periphery.address
    );

    // rebalance
    await activeLPManagementStrategyTest
      .connect(wallet)
      .rebalance(startingTickLower, startingTickUpper);

    // checks
    expect(await activeLPManagementStrategyTest.tickLower()).to.eq(
      startingTickLower
    );
    expect(await activeLPManagementStrategyTest.tickUpper()).to.eq(
      startingTickUpper
    );

    // approve the lp optimizer to deposit erc20 tokens
    await token
      .connect(wallet)
      .approve(activeLPManagementStrategyTest.address, lpDepositAmount);

    // other deposits margin into the lp vault
    await activeLPManagementStrategyTest
      .connect(wallet)
      .deposit(lpDepositAmount);

    // liquidity gets traded left <-> right (ft followed by vt)
    await periphery.connect(other).swap({
      marginEngine: marginEngineTest.address,
      isFT: true,
      notional: lpDepositAmount.mul(5),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: lpDepositAmount,
      sqrtPriceLimitX96:
        TickMath.getSqrtRatioAtTick(startingTickUpper).toString(),
    });

    await periphery.connect(other).swap({
      marginEngine: marginEngineTest.address,
      isFT: false,
      notional: lpDepositAmount.mul(5),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: lpDepositAmount,
      sqrtPriceLimitX96:
        TickMath.getSqrtRatioAtTick(startingTickLower).toString(),
    });

    // check fee income
    let position = await marginEngineTest.callStatic.getPosition(
      activeLPManagementStrategyTest.address,
      startingTickLower,
      startingTickUpper
    );

    let cumulativeGeneratedFees = position.accumulatedFees;

    console.log(
      "generated fees before rebalance ",
      utils.formatEther(cumulativeGeneratedFees)
    );

    // rebalance
    await activeLPManagementStrategyTest
      .connect(wallet)
      .rebalance(updatedTickLower, updatedTickUpper);

    // checks
    expect(await activeLPManagementStrategyTest.tickLower()).to.eq(
      updatedTickLower
    );
    expect(await activeLPManagementStrategyTest.tickUpper()).to.eq(
      updatedTickUpper
    );

    // market conditions have changed, and now liquidity is traded right <-> left (vt followed by ft)
    await periphery.connect(other).swap({
      marginEngine: marginEngineTest.address,
      isFT: false,
      notional: lpDepositAmount.mul(5),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: lpDepositAmount,
      sqrtPriceLimitX96:
        TickMath.getSqrtRatioAtTick(updatedTickLower).toString(),
    });

    await periphery.connect(other).swap({
      marginEngine: marginEngineTest.address,
      isFT: true,
      notional: lpDepositAmount.mul(5),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: lpDepositAmount,
      sqrtPriceLimitX96:
        TickMath.getSqrtRatioAtTick(updatedTickUpper).toString(),
    });

    // check fee income
    position = await marginEngineTest.callStatic.getPosition(
      activeLPManagementStrategyTest.address,
      updatedTickLower,
      updatedTickUpper
    );

    cumulativeGeneratedFees = cumulativeGeneratedFees.add(
      position.accumulatedFees
    );

    console.log(
      "generated fees after rebalance ",
      utils.formatEther(cumulativeGeneratedFees)
    );
  });
});
