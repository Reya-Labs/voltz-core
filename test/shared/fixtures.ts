import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { BigNumber } from "@ethersproject/bignumber";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { AaveFCM } from "../../typechain/AaveFCM";

import {
  E2ESetup,
  ERC20Mock,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  MockAToken,
  SqrtPriceMathTest,
  TestLiquidatorBot,
  TickMathTest,
} from "../../typechain";

import { consts } from "../helpers/constants";

import { ethers, waffle } from "hardhat";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";

import { toBn } from "evm-bn";
import { e2eParameters } from "../end_to_end/general_setup/e2eSetup";
import { TICK_SPACING } from "./utilities";
const { provider } = waffle;

export async function mockATokenFixture(
  _aaveLendingPoolAddress: string,
  _underlyingAsset: string
) {
  const mockATokenFactory = await ethers.getContractFactory("MockAToken");

  const mockAToken = (await mockATokenFactory.deploy(
    _aaveLendingPoolAddress,
    _underlyingAsset,
    "Voltz aUSD",
    "aVUSD"
  )) as MockAToken;

  return { mockAToken };
}

export async function mockERC20Fixture() {
  const MockERC20Factory = await ethers.getContractFactory("ERC20Mock");

  const token = (await MockERC20Factory.deploy(
    "Voltz USD",
    "VUSD"
  )) as ERC20Mock;

  return { token };
}

export async function mockAaveLendingPoolFixture() {
  const MockAaveLendingPoolFactory = await ethers.getContractFactory(
    "MockAaveLendingPool"
  );

  const aaveLendingPool =
    (await MockAaveLendingPoolFactory.deploy()) as MockAaveLendingPool;

  return { aaveLendingPool };
}

export async function fcmMasterTestFixture() {
  const fcmMasterTestFactory = await ethers.getContractFactory("AaveFCM");
  const fcmMasterTest = (await fcmMasterTestFactory.deploy()) as AaveFCM;

  return { fcmMasterTest };
}

export async function vammMasterTestFixture() {
  const vammMasterTestFactory = await ethers.getContractFactory("TestVAMM");
  const vammMasterTest = (await vammMasterTestFactory.deploy()) as TestVAMM;

  return { vammMasterTest };
}

export async function marginEngineMasterTestFixture() {
  const marginEngineMasterTestFactory = await ethers.getContractFactory(
    "TestMarginEngine"
  );
  const marginEngineMasterTest =
    (await marginEngineMasterTestFactory.deploy()) as TestMarginEngine;

  return { marginEngineMasterTest };
}

export async function liquidatorBotTestFixture() {
  const liquidatorBotTestFactory = await ethers.getContractFactory(
    "TestLiquidatorBot"
  );

  const liquidatorBotTest =
    (await liquidatorBotTestFactory.deploy()) as TestLiquidatorBot;

  return { liquidatorBotTest };
}

export async function marginCalculatorFixture() {
  const TestMarginCalculatorFactory = await ethers.getContractFactory(
    "MarginCalculatorTest"
  );

  const testMarginCalculator =
    (await TestMarginCalculatorFactory.deploy()) as MarginCalculatorTest;

  return { testMarginCalculator };
}

export async function sqrtPriceMathFixture() {
  const SqrtPriceMathFactory = await ethers.getContractFactory(
    "SqrtPriceMathTest"
  );

  const testSqrtPriceMath =
    (await SqrtPriceMathFactory.deploy()) as SqrtPriceMathTest;

  return { testSqrtPriceMath };
}

export async function fixedAndVariableMathFixture() {
  const fixedAndVariableMathFactory = await ethers.getContractFactory(
    "FixedAndVariableMathTest"
  );

  const testFixedAndVariableMath =
    (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMathTest;

  return { testFixedAndVariableMath };
}

export async function E2ESetupFixture() {
  const E2ESetupFactory = await ethers.getContractFactory("E2ESetup");

  const e2eSetup = (await E2ESetupFactory.deploy()) as E2ESetup;

  return { e2eSetup };
}

export async function ActorFixture() {
  const ActorFactory = await ethers.getContractFactory("Actor");

  const actor = await ActorFactory.deploy();

  return { actor };
}

export async function tickMathFixture() {
  const TickMathFactury = await ethers.getContractFactory("TickMathTest");

  const testTickMath = (await TickMathFactury.deploy()) as TickMathTest;

  return { testTickMath };
}

export async function factoryFixture(
  _masterMarginEngineAddress: string,
  _masterVAMMAddress: string
) {
  const factoryFactory = await ethers.getContractFactory("Factory");
  const factory = (await factoryFactory.deploy(
    _masterMarginEngineAddress,
    _masterVAMMAddress
  )) as Factory;

  return { factory };
}

export async function rateOracleTestFixture(
  _aaveLendingPoolAddress: string,
  _underlyingAddress: string
) {
  const rateOracleTestFactory = await ethers.getContractFactory(
    "TestRateOracle"
  );
  const rateOracleTest = (await rateOracleTestFactory.deploy(
    _aaveLendingPoolAddress,
    _underlyingAddress
  )) as TestRateOracle;

  return { rateOracleTest };
}

interface MetaFixture {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  rateOracleTest: TestRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
  mockAToken: MockAToken;
  marginEngineTest: TestMarginEngine;
  vammTest: TestVAMM;
  fcmTest: AaveFCM;
}

export const metaFixture = async function (): Promise<MetaFixture> {
  const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
  const { vammMasterTest } = await vammMasterTestFixture();
  const { fcmMasterTest } = await fcmMasterTestFixture();
  const { factory } = await factoryFixture(
    marginEngineMasterTest.address,
    vammMasterTest.address
  );
  const { token } = await mockERC20Fixture();
  const { aaveLendingPool } = await mockAaveLendingPoolFixture();
  const { rateOracleTest } = await rateOracleTestFixture(
    aaveLendingPool.address,
    token.address
  );

  const { mockAToken } = await mockATokenFixture(
    aaveLendingPool.address,
    token.address
  );

  await aaveLendingPool.setReserveNormalizedIncome(
    token.address,
    BigNumber.from(10).pow(27)
  );

  await aaveLendingPool.initReserve(token.address, mockAToken.address);

  await rateOracleTest.increaseObservationCardinalityNext(5);
  // write oracle entry
  await rateOracleTest.writeOracleEntry();
  // advance time after first write to the oracle
  await advanceTimeAndBlock(consts.ONE_DAY, 2); // advance by one day
  await rateOracleTest.writeOracleEntry();

  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_WEEK.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

  const UNDERLYING_YIELD_BEARING_PROTOCOL_ID =
    await rateOracleTest.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

  // set master fcm for aave
  await factory.setMasterFCM(
    fcmMasterTest.address,
    UNDERLYING_YIELD_BEARING_PROTOCOL_ID
  );

  // deploy a margin engine & vamm
  const deployTrx = await factory.deployIrsInstance(
    token.address,
    rateOracleTest.address,
    termStartTimestampBN,
    termEndTimestampBN,
    TICK_SPACING
  );
  const receiptLogs = (await deployTrx.wait()).logs;
  // console.log("receiptLogs", receiptLogs);
  const log = factory.interface.parseLog(receiptLogs[receiptLogs.length - 3]);
  if (log.name !== "IrsInstance") {
    throw Error(
      "IrsInstance log not found. Has it moved to a different position in the array?"
    );
  }
  // console.log("log", log);
  const marginEngineAddress = log.args.marginEngine;
  const vammAddress = log.args.vamm;
  const fcmAddress = log.args.fcm;

  const marginEngineTestFactory = await ethers.getContractFactory(
    "TestMarginEngine"
  );
  const marginEngineTest = marginEngineTestFactory.attach(
    marginEngineAddress
  ) as TestMarginEngine;

  const vammTestFactory = await ethers.getContractFactory("TestVAMM");
  const vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

  const fcmTestFactory = await ethers.getContractFactory("AaveFCM");
  const fcmTest = fcmTestFactory.attach(fcmAddress) as AaveFCM;

  return {
    factory,
    vammMasterTest,
    marginEngineMasterTest,
    token,
    rateOracleTest,
    aaveLendingPool,
    termStartTimestampBN,
    termEndTimestampBN,
    mockAToken,
    marginEngineTest,
    vammTest,
    fcmTest,
  };
};

interface MetaFixtureScenario1E2E {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  rateOracleTest: TestRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
  testMarginCalculator: MarginCalculatorTest;
}

export const metaFixtureScenario1E2E =
  async function (): Promise<MetaFixtureScenario1E2E> {
    const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
    const { vammMasterTest } = await vammMasterTestFixture();
    const { factory } = await factoryFixture(
      marginEngineMasterTest.address,
      vammMasterTest.address
    );
    const { token } = await mockERC20Fixture();
    const { aaveLendingPool } = await mockAaveLendingPoolFixture();
    const { rateOracleTest } = await rateOracleTestFixture(
      aaveLendingPool.address,
      token.address
    );

    const { testMarginCalculator } = await marginCalculatorFixture();

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1000000000000000000000000000" // 10^27
    );

    await rateOracleTest.increaseObservationCardinalityNext(100);
    // write oracle entry
    await rateOracleTest.writeOracleEntry();
    // advance time after first write to the oracle
    await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1008000000000000000000000000" // 10^27 * 1.008
    );

    await rateOracleTest.writeOracleEntry();

    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + consts.THREE_MONTH.toNumber();
    const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

    return {
      factory,
      vammMasterTest,
      marginEngineMasterTest,
      token,
      rateOracleTest,
      aaveLendingPool,
      termStartTimestampBN,
      termEndTimestampBN,
      testMarginCalculator,
    };
  };

interface MetaFixtureE2E {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  mockAToken: MockAToken;
  rateOracleTest: TestRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
  testMarginCalculator: MarginCalculatorTest;
}

export const createMetaFixtureE2E = async function (e2eParams: e2eParameters) {
  const metaFixtureE2E = async function (): Promise<MetaFixtureE2E> {
    const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
    const { vammMasterTest } = await vammMasterTestFixture();
    const { fcmMasterTest } = await fcmMasterTestFixture();
    const { factory } = await factoryFixture(
      marginEngineMasterTest.address,
      vammMasterTest.address
    );
    const { token } = await mockERC20Fixture();
    const { aaveLendingPool } = await mockAaveLendingPoolFixture();
    const { rateOracleTest } = await rateOracleTestFixture(
      aaveLendingPool.address,
      token.address
    );

    const { testMarginCalculator } = await marginCalculatorFixture();

    const { mockAToken } = await mockATokenFixture(
      aaveLendingPool.address,
      token.address
    );

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      BigNumber.from(10).pow(27)
    );

    await aaveLendingPool.initReserve(token.address, mockAToken.address);

    // await rateOracleTest.testGrow(100);
    await rateOracleTest.increaseObservationCardinalityNext(100);
    // write oracle entry
    await rateOracleTest.writeOracleEntry();
    // advance time after first write to the oracle
    await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

    await aaveLendingPool.setReserveNormalizedIncome(
      token.address,
      "1008000000000000000000000000" // 10^27 * 1.008
    );

    await rateOracleTest.writeOracleEntry();

    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + e2eParams.duration.toNumber();
    const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

    const UNDERLYING_YIELD_BEARING_PROTOCOL_ID =
      await rateOracleTest.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

    // set master fcm for aave
    await factory.setMasterFCM(
      fcmMasterTest.address,
      UNDERLYING_YIELD_BEARING_PROTOCOL_ID
    );

    return {
      factory,
      vammMasterTest,
      marginEngineMasterTest,
      token,
      mockAToken,
      rateOracleTest,
      aaveLendingPool,
      termStartTimestampBN,
      termEndTimestampBN,
      testMarginCalculator,
    };
  };

  return metaFixtureE2E;
};
