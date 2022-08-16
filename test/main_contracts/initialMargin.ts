import { Wallet, BigNumber, utils } from "ethers";
import { ethers, waffle } from "hardhat";
import { metaFixture, tickMathFixture } from "../shared/fixtures";
import { poolConfigs } from "../../deployConfig/poolConfig";
import { expect } from "../shared/expect";

import { getCurrentTimestamp, setTimeNextBlock } from "../helpers/time";
import {
  ERC20Mock,
  MockRateOracle,
  TestMarginEngine,
  TestVAMM,
  TickMathTest,
} from "../../typechain";
import { toBn } from "../helpers/toBn";

const createFixtureLoader = waffle.createFixtureLoader;

async function mockRateOracleFixture() {
  const mockRateOracleFactory = await ethers.getContractFactory(
    "MockRateOracle"
  );
  const mockRateOracle = (await mockRateOracleFactory
    .deploy
    // _aaveLendingPoolAddress,
    // _underlyingAddress
    ()) as MockRateOracle;

  return mockRateOracle;
}

describe("Initial vs. Liquidation Margin Tests", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  let marginEngineTest: TestMarginEngine;
  let token: ERC20Mock;

  let mockRateOracle: MockRateOracle;
  let testTickMath: TickMathTest;
  let vammTest: TestVAMM;

  let margin_engine_params: any;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    ({ testTickMath } = await loadFixture(tickMathFixture));
  });

  beforeEach("deploy fixture", async () => {
    ({ token, marginEngineTest, vammTest } = await loadFixture(metaFixture));
    mockRateOracle = await loadFixture(mockRateOracleFixture);
    await marginEngineTest.setRateOracle(mockRateOracle.address);

    // set vamm in the margin engine
    await marginEngineTest.setVAMM(vammTest.address);

    // set the rate oracle to a mock rate oracle

    // update marginEngineTest allowance
    await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));
    await token
      .connect(other)
      .approve(marginEngineTest.address, BigNumber.from(10).pow(27));

    await token.mint(wallet.address, BigNumber.from(10).pow(27));
    await token.approve(wallet.address, BigNumber.from(10).pow(27));

    margin_engine_params = {
      ...poolConfigs.aUSDC.marginCalculatorParams,
      minMarginToIncentiviseLiquidators: 0, // keep zero for now then do tests with the min liquidator incentive
    };

    await marginEngineTest.setMarginCalculatorParameters(margin_engine_params);
  });

  describe("#getPositionMarginRequirement", async () => {
    const LIQUIDATION = true;
    const INITIAL = false;

    it("dogfooding liquidaiton 1", async () => {
      // TODO: generalise code (including setting margin calculator params) and write more test cases; or better yet generate them from task output (getHistoricalPostionHealth?) whenever we find problems
      const dogfoodingTestCase = {
        tickLower: -13860,
        tickUpper: 69060,
        sqrtPrice: "55681964341720680471084121119",
        expectedTick: -7054,
        fixedTokenBalance: toBn("-0.000000112411886711"),
        variableTokenBalance: toBn("0.000000050597152345"),
        liquidityWad: toBn("0.000000804130259824"),
        variableFactor: toBn("0.000002687422823751"),
        apyFromTo: toBn("0.006016596856543646"),
        timestampOfQuery: 1659267429,
        irsStartTimestamp: "1659254400000000000000000000",
        irsEndTimestamp: "1664539200000000000000000000",
      };
      const t = dogfoodingTestCase;

      await vammTest.initializeVAMM(t.sqrtPrice);
      const tick = (await vammTest.vammVars()).tick;
      expect(tick).equals(t.expectedTick);

      await mockRateOracle.setVariableFactor(t.variableFactor);
      await mockRateOracle.setApyFromTo(t.apyFromTo);

      await setTimeNextBlock(t.timestampOfQuery); // TODO: can't hard-code this here. Need to calculate start and end offsets vs. next block time, and use those without changing block time
      await marginEngineTest.setTermTimestamps(
        t.irsStartTimestamp,
        t.irsEndTimestamp
      );
      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        t.tickLower,
        t.tickUpper,
        t.liquidityWad,
        t.fixedTokenBalance,
        t.variableTokenBalance,
        toBn("0"),
        LIQUIDATION
      );
      const realizedLiqu = await marginEngineTest.getMargin();
      await marginEngineTest.getCounterfactualMarginRequirementTest(
        wallet.address,
        t.tickLower,
        t.tickUpper,
        t.liquidityWad,
        t.fixedTokenBalance,
        t.variableTokenBalance,
        toBn("0"),
        INITIAL
      );
      const realizedInit = await marginEngineTest.getMargin();
      console.log("liqu margin req", utils.formatEther(realizedLiqu));
      console.log("init margin req", utils.formatEther(realizedInit));

      // This is the current reality, but this result constitues a failure
      expect(realizedLiqu, "liqu").to.be.near(toBn("0.000000002125262934"));
      expect(realizedInit, "init").to.be.near(toBn("0.000000002125262934"));

      expect(
        realizedLiqu,
        "Initial and Liquidation requirements should not match but they do!"
      ).not.to.be.near(realizedInit);
    });
  });
});
