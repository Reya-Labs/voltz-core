import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import { expect } from "../shared/expect";
import { metaFixtureScenario1E2E } from "../shared/fixtures";
import {
  TICK_SPACING,
  getMaxLiquidityPerTick,
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  encodeSqrtRatioX96,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import {
  ERC20Mock,
  Factory,
  MockAaveLendingPool,
  TestRateOracle,
} from "../../typechain";
import { consts } from "../helpers/constants";
import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";

const createFixtureLoader = waffle.createFixtureLoader;

const { provider } = waffle;

const AGRESSIVE_SIGMA_SQUARED: BigNumber = toBn("0.15");

describe("VAMM", () => {
  let wallet: Wallet, other: Wallet;
  let token: ERC20Mock;
  let factory: Factory;
  let rateOracleTest: TestRateOracle;
  let termStartTimestampBN: BigNumber;
  let termEndTimestampBN: BigNumber;
  let vammTest: TestVAMM;
  let marginEngineTest: TestMarginEngine;
  let aaveLendingPool: MockAaveLendingPool;
  let testMarginCalculator: MarginCalculatorTest;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });

  beforeEach("deploy fixture", async () => {
    ({
      factory,
      token,
      rateOracleTest,
      aaveLendingPool,
      termStartTimestampBN,
      termEndTimestampBN,
      testMarginCalculator,
    } = await loadFixture(metaFixtureScenario1E2E));

    // deploy a margin engine & vamm
    await factory.deployIrsInstance(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const marginEngineAddress = await factory.getMarginEngineAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );
    marginEngineTest = marginEngineTestFactory.attach(marginEngineAddress);
    const vammAddress = await factory.getVAMMAddress(
      token.address,
      rateOracleTest.address,
      termStartTimestampBN,
      termEndTimestampBN
    );
    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    vammTest = vammTestFactory.attach(vammAddress);
    await marginEngineTest.setVAMMAddress(vammTest.address);

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    const marginCalculatorParams = {
      apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
      apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
      sigmaSquaredWad: AGRESSIVE_SIGMA_SQUARED,
      alphaWad: ALPHA,
      betaWad: BETA,
      xiUpperWad: XI_UPPER,
      xiLowerWad: XI_LOWER,
      tMaxWad: T_MAX,
    };

    await marginEngineTest.setMarginCalculatorParameters(
      marginCalculatorParams
    );
    await marginEngineTest.setSecondsAgo(consts.ONE_WEEK);

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token.approve(wallet.address, BigNumber.from(10).pow(27));

    await token.mint(other.address, BigNumber.from(10).pow(27));
    await token.approve(other.address, BigNumber.from(10).pow(27));

    await vammTest.initializeVAMM(encodeSqrtRatioX96(1, 1).toString());

    await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(TICK_SPACING));
    await vammTest.setTickSpacing(TICK_SPACING);

    // set the fees differently in scenario 2
    await vammTest.setFeeProtocol(0);
    await vammTest.setFee(0);
  });

  describe("#Scenario1", () => {
    it("full scenario 1", async () => {
      const currentReseveNormalisedIncome =
        await aaveLendingPool.getReserveNormalizedIncome(token.address);
      console.log(
        "currentReseveNormalisedIncome",
        currentReseveNormalisedIncome
      ); // in ray

      // check apy bounds

      const currentTimestamp: number = await getCurrentTimestamp(provider);
      const currrentTimestampWad: BigNumber = toBn(currentTimestamp.toString());
      const historicalApyWad: BigNumber =
        await marginEngineTest.getHistoricalApy();

      console.log("historical apy wad", historicalApyWad.toString());

      const marginCalculatorParams = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        sigmaSquaredWad: AGRESSIVE_SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      const upperApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampBN,
        currrentTimestampWad,
        historicalApyWad,
        true,
        marginCalculatorParams
      );
      const lowerApyBound = await testMarginCalculator.computeApyBound(
        termEndTimestampBN,
        currrentTimestampWad,
        historicalApyWad,
        false,
        marginCalculatorParams
      );

      console.log("upper apy bound", utils.formatEther(upperApyBound));
      console.log("lower apy bound", utils.formatEther(lowerApyBound));

      const variableFactorWad = await rateOracleTest.variableFactorNoCache(
        termStartTimestampBN,
        termEndTimestampBN
      );

      console.log("variableFactorWad", variableFactorWad); // displayed as zero, investigate

      const position_margin_requirement_params = {
        owner: wallet.address,
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        isLM: false,
        currentTick: 0,
        termStartTimestampWad: termStartTimestampBN,
        termEndTimestampWad: termEndTimestampBN,
        liquidity: toBn("1000000"),
        fixedTokenBalance: toBn("0"),
        variableTokenBalance: toBn("0"),
        variableFactorWad: variableFactorWad,
        historicalApyWad: historicalApyWad,
      };

      const postitionMarginrRequirement =
        await testMarginCalculator.getPositionMarginRequirementTest(
          position_margin_requirement_params,
          marginCalculatorParams
        );

      console.log(
        "position margin requirement",
        utils.formatEther(postitionMarginrRequirement)
      );

      // First LP deposits margin and mints liquidity right after the pool initialisation
      // Should trigger a write to the rate oracle

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("180")
      );

      await expect(
        vammTest.mint(
          wallet.address,
          -TICK_SPACING,
          TICK_SPACING,
          toBn("1000000")
        )
      ).to.be.reverted;

      await marginEngineTest.updatePositionMargin(
        {
          owner: wallet.address,
          tickLower: -TICK_SPACING,
          tickUpper: TICK_SPACING,
          liquidityDelta: 0,
        },
        toBn("20")
      );

      await vammTest.mint(
        wallet.address,
        -TICK_SPACING,
        TICK_SPACING,
        toBn("1000000")
      );
    });
  });
});
