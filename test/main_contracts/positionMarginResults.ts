import { Wallet, BigNumber } from "ethers";
import { ethers, waffle } from "hardhat";
import { metaFixture } from "../shared/fixtures";
import { poolConfigs } from "../../deployConfig/poolConfig";
import { expect } from "../shared/expect";

import { getCurrentTimestamp } from "../helpers/time";
import {
  ERC20Mock,
  MockRateOracle,
  TestMarginEngine,
  TestVAMM,
} from "../../typechain";
import { toBn } from "../helpers/toBn";

const createFixtureLoader = waffle.createFixtureLoader;
const dogfoodingTestCase_block15250000 = {
  tickLower: -13860,
  tickUpper: 69060,
  description: `S aUSDC liquidation @ block 15250000`,
  sqrtPrice: "55681964341720680471084121119",
  expectedTick: -7054,
  fixedTokenBalance: toBn("-0.000000112411886711"),
  variableTokenBalance: toBn("0.000000050597152345"),
  liquidityWad: toBn("0.000000804130259824"),
  variableFactor: toBn("0.000002687422823751"),
  apyFromTo: toBn("0.006016596856543646"),
  timestampOfQuery: 1659267429,
  irsStartTimestamp: 1659254400,
  irsEndTimestamp: 1664539200,
  margin_engine_params: poolConfigs.aUSDC.marginCalculatorParams,
  upperBoundOfInitialMargin: toBn("0.000000002125262934"), // observed values were too high
  upperBoundOfLiquidationMargin: toBn("0.000000002125262934"), // observed values were too high
};
const dogfoodingTestCase_block15251000 = {
  ...dogfoodingTestCase_block15250000,
  description: `S aUSDC liquidation @ block 15251000`,
  variableFactor: toBn("0.000005496826969195"),
  apyFromTo: toBn("0.00564405885879056"),
  timestampOfQuery: 1659280735,
  upperBoundOfMargin: toBn("0.000000002190319851"), // observed values were too high
  upperBoundOfLiquidationMargin: toBn("0.000000002190319851"), // observed values were too high
};
async function mockRateOracleFixture() {
  const mockRateOracleFactory = await ethers.getContractFactory(
    "MockRateOracle"
  );
  const mockRateOracle =
    (await mockRateOracleFactory.deploy()) as MockRateOracle;

  return mockRateOracle;
}

describe("Margin Tests for specific positions", () => {
  // We can add test cases here based on real world observations

  const LIQUIDATION = true;
  const INITIAL = false;
  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  let marginEngineTest: TestMarginEngine;
  let token: ERC20Mock;

  let mockRateOracle: MockRateOracle;
  let vammTest: TestVAMM;

  let margin_engine_params: any;

  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    mockRateOracle = await loadFixture(mockRateOracleFixture);
  });

  describe("#getPositionMarginRequirement", async () => {
    beforeEach("deploy fixture", async () => {
      // We need a new VAMM, and therefore ME, for each test because price initialisation is one-time
      ({ token, marginEngineTest, vammTest } = await loadFixture(metaFixture));
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

      margin_engine_params = poolConfigs.aUSDC.marginCalculatorParams;

      await marginEngineTest.setMarginCalculatorParameters(
        margin_engine_params
      );
    });

    for (const t of [
      dogfoodingTestCase_block15250000,
      dogfoodingTestCase_block15251000,
    ]) {
      it(`dogfooding liquidation: ${t.description}`, async () => {
        await marginEngineTest.setMarginCalculatorParameters(
          t.margin_engine_params
        );

        await vammTest.initializeVAMM(t.sqrtPrice);
        const tick = (await vammTest.vammVars()).tick;
        expect(tick).equals(t.expectedTick);

        await mockRateOracle.setApyFromTo(t.apyFromTo);
        await mockRateOracle.setVariableFactor(t.variableFactor);

        // We recreate the conditions of the observation not in absolute terms, but in relative terms
        // The duration of the IRS must be the same, and the number of seconds we are into that must be the same
        const currentTimestamp = await getCurrentTimestamp();
        const startOffset = t.timestampOfQuery - t.irsStartTimestamp;
        const endOffset = t.irsEndTimestamp - t.timestampOfQuery;
        // await setTimeNextBlock(t.timestampOfQuery); // TODO: can't hard-code this here. Need to calculate start and end offsets vs. next block time, and use those without changing block time
        await marginEngineTest.setTermTimestamps(
          toBn(currentTimestamp + 1 - startOffset), // +1 because this transaction will mine a new block
          toBn(currentTimestamp + 1 + endOffset) // +1 because this transaction will mine a new block
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

        // We expect results that are below the observed values
        expect(realizedLiqu, "liqu").to.be.lt(t.upperBoundOfLiquidationMargin);
        expect(realizedInit, "init").to.be.lt(t.upperBoundOfInitialMargin);
      });
    }
  });
});
