import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { expect } from "../shared/expect";
import { liquidatorBotTestFixture, metaFixture } from "../shared/fixtures";
import { toBn } from "evm-bn";
import {
  ERC20Mock,
  Factory,
  MockAaveLendingPool,
  MockWETH,
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

      etaIMWad: toBn("0.002"),
      etaLMWad: toBn("0.001"),
      gap1: toBn("0"),
      gap2: toBn("0"),
      gap3: toBn("0"),
      gap4: toBn("0"),
      gap5: toBn("0"),
      gap6: toBn("0"),

      gammaWad: toBn("1.0"),
      minMarginToIncentiviseLiquidators: 0,
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);

    await marginEngineTest.setLookbackWindowInSeconds(consts.ONE_DAY);

    // deploy mock WETH
    const wethFactory = await ethers.getContractFactory("MockWETH");
    const weth = (await wethFactory.deploy("Wrapped ETH", "WETH")) as MockWETH;

    // deploy the periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");
    const peripheryImpl = await peripheryFactory.deploy();

    const proxyFactory = await ethers.getContractFactory("VoltzERC1967Proxy");

    const proxyInstance = await proxyFactory.deploy(peripheryImpl.address, []);

    periphery = (await ethers.getContractAt(
      "Periphery",
      proxyInstance.address
    )) as Periphery;
    await periphery.initialize(weth.address);

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

  it("execute a liquidation via a simple liquidator bot", async () => {
    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1008000000000000000010000000"
    );

    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1); // advance by two days

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1008000000000000000020000000"
    );

    await rateOracleTest.writeOracleEntry();

    // check current historical apy in the underlying aave lending pool captured by Voltz Protocol Rate Oracle
    let historicalApyWad: BigNumber =
      await marginEngineTest.callStatic.getHistoricalApy();

    console.log(
      "Historical APY: ",
      utils.formatEther(historicalApyWad).toString(),
      "%"
    );

    // set the liquidator reward for the margin engine
    const _liquidatorRewardWad = toBn("0.05");

    await marginEngineTest.setLiquidatorReward(_liquidatorRewardWad);

    // deploy the test liquidator bot smart contract
    ({ liquidatorBotTest } = await loadFixture(liquidatorBotTestFixture));

    // set the margin engine associated with the liquidator bot
    await liquidatorBotTest.setMarginEngine(marginEngineTest.address);

    // fetch the newly set margin engine address
    const marginEngineAddressAssociatedWithBot =
      await liquidatorBotTest.marginEngine();

    // check if the marginEngineAddressAssociatedWithBot matches with the test margin engine address deployed in beforeEach
    expect(marginEngineAddressAssociatedWithBot).to.eq(
      marginEngineTest.address
    );

    // get liquidator reward by fetching it from the margin engine via the liquidator bot smart contract
    const liquidatorRewardWad =
      await liquidatorBotTest.getMELiquidatorRewardWad();

    // check if liquidatorRewardWad fetched by the LiquidatorBot matches the value we set at the beginning of the unit test
    expect(liquidatorRewardWad).to.eq(_liquidatorRewardWad);

    // scenario starts

    // a liquidity provider (wallet) mints liquidity via the periphery
    await periphery.connect(wallet).mintOrBurn({
      marginEngine: marginEngineTest.address,
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      notional: toBn("10000000"),
      isMint: true,
      marginDelta: toBn("500000"),
    });

    // check the liquidation margin requirement of the fixed taker above
    let liquidationMarginRequirement: BigNumber =
      await liquidatorBotTest.callStatic.getLiquidationMarginRequirement(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

    console.log(
      "liquidationMarginRequirement in VUSD",
      utils.formatEther(liquidationMarginRequirement).toString()
    );

    // check the initial margin requirement of the fixed taker above

    const initialMarginRequirement =
      await marginEngineTest.callStatic.getPositionMarginRequirement(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        false
      );

    console.log(
      "initialMarginRequirement in VUSD",
      utils.formatEther(initialMarginRequirement).toString()
    );

    // we attempt a liquidation in here, it is expected to fail since the liqudity provider has sufficient amount of margin in underlying tokens

    await expect(
      liquidatorBotTest.liquidatePosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      )
    ).to.be.revertedWith("CannotLiquidate");

    // advance time by one day, artificially modify the reserved normalized income in the underlying aaveLendingPool in order to affect the historical apy
    // captured by the test rate oracle which is then used to compute margin requirements

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1008000000000000000030000000"
    );

    await rateOracleTest.writeOracleEntry();

    await advanceTimeAndBlock(consts.ONE_DAY.mul(2), 1); // advance by two days

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1030000000000000000090000000"
    );

    await rateOracleTest.writeOracleEntry();

    // check current historical apy in the underlying aave lending pool captured by Voltz Protocol Rate Oracle
    historicalApyWad = await marginEngineTest.callStatic.getHistoricalApy();

    console.log(
      "Historical APY: ",
      utils.formatEther(historicalApyWad).toString(),
      "%"
    );

    liquidationMarginRequirement =
      await liquidatorBotTest.callStatic.getLiquidationMarginRequirement(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

    console.log(
      "liquidationMarginRequirement in VUSD",
      utils.formatEther(liquidationMarginRequirement).toString()
    );

    const liquidatorRewardAmount: BigNumber = await liquidatorBotTest
      .connect(other)
      .callStatic.liquidatePosition(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING
      );

    console.log(
      "liquidatorRewardAmount in VUSD",
      utils.formatEther(liquidatorRewardAmount).toString()
    );

    // liquidate the position

    let balanceOfLiquidator: BigNumber = await token.balanceOf(
      liquidatorBotTest.address
    );
    console.log(
      "Balance of liquidator in underlying VUSD before liquidation",
      utils.formatEther(balanceOfLiquidator).toString()
    );

    await liquidatorBotTest
      .connect(other)
      .liquidatePosition(wallet.address, -TICK_SPACING, TICK_SPACING);

    balanceOfLiquidator = await token.balanceOf(liquidatorBotTest.address);

    console.log(
      "Balance of liquidator in underlying VUSD after successful liquidation",
      utils.formatEther(balanceOfLiquidator).toString()
    );
  });
});
