import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { BigNumber } from "@ethersproject/bignumber";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { TestCompoundRateOracle } from "../../typechain/TestCompoundRateOracle";
import { AaveFCM } from "../../typechain/AaveFCM";

import {
  CompoundRateOracle,
  E2ESetup,
  ERC20Mock,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  MockAToken,
  MockCToken,
  SqrtPriceMathTest,
  TestActiveLPManagementStrategy,
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
import { CompoundFCM } from "../../typechain/CompoundFCM";
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

export async function mockCTokenFixture(_underlyingAsset: string) {
  const mockCTokenFactory = await ethers.getContractFactory("MockCToken");

  const mockCToken = (await mockCTokenFactory.deploy(
    _underlyingAsset,
    "Voltz cDAI",
    "cVDAI"
  )) as MockCToken;

  return { mockCToken };
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
  const fcmMasterCompoundFactory = await ethers.getContractFactory(
    "CompoundFCM"
  );
  const fcmMasterCompound =
    (await fcmMasterCompoundFactory.deploy()) as CompoundFCM;

  return { fcmMasterTest, fcmMasterCompound };
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

export async function activeLPManagementStrategyTestFixture() {
  const activeLPManagementStrategyTestFactory = await ethers.getContractFactory(
    "TestActiveLPManagementStrategy"
  );

  const activeLPManagementStrategyTest =
    (await activeLPManagementStrategyTestFactory.deploy()) as TestActiveLPManagementStrategy;

  return { activeLPManagementStrategyTest };
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

export async function compoundRateOracleTestFixture(
  _cTokenAddress: string,
  _underlyingAddress: string
) {
  const compoundRateOracleTestFactory = await ethers.getContractFactory(
    "TestCompoundRateOracle"
  );
  const compoundRateOracleTest = (await compoundRateOracleTestFactory.deploy(
    _cTokenAddress,
    _underlyingAddress,
    18 // token decimals
  )) as TestCompoundRateOracle;

  return { compoundRateOracleTest };
}

interface MetaFixture {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  rateOracleTest: TestRateOracle;
  compoundRateOracleTest: TestCompoundRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
  mockAToken: MockAToken;
  mockCToken: MockCToken;
  marginEngineTest: TestMarginEngine;
  marginEngineCompound: TestMarginEngine;
  vammTest: TestVAMM;
  vammCompound: TestVAMM;
  fcmTest: AaveFCM;
  fcmCompound: CompoundFCM;
}

export const metaFixture = async function (): Promise<MetaFixture> {
  const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
  const { vammMasterTest } = await vammMasterTestFixture();
  const { fcmMasterTest, fcmMasterCompound } = await fcmMasterTestFixture();
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

  // const cToken = (await mockCTokenFixture()).token; ab: what's the purpose of this line??
  const { mockCToken } = await mockCTokenFixture(token.address);

  const decimals = await token.decimals();
  // console.log("decimals", decimals);

  // Starting exchange rate = 0.02, expressed using 10 ^ (18 + underlyingDecimals - cTokenDecimals)
  //  = 0.02 * 10 ^ (18 + 18 - 8)
  //  = 0.02 * 10 ^ 28
  //  = 2 * 10^26
  await mockCToken.setExchangeRate(BigNumber.from(10).pow(26).mul(2));

  const exchangeRateStored = await mockCToken.exchangeRateStored();

  // console.log("exchangeRateStored", exchangeRateStored.toString());

  const { compoundRateOracleTest } = await compoundRateOracleTestFixture(
    mockCToken.address,
    token.address
  );

  await aaveLendingPool.setReserveNormalizedIncome(
    token.address,
    BigNumber.from(10).pow(27)
  );

  await aaveLendingPool.initReserve(token.address, mockAToken.address);

  await rateOracleTest.increaseObservationCardinalityNext(10);
  await compoundRateOracleTest.increaseObservationCardinalityNext(10);
  // write oracle entry
  await rateOracleTest.writeOracleEntry();
  await compoundRateOracleTest.writeOracleEntry();
  // advance time after first write to the oracle
  await advanceTimeAndBlock(consts.ONE_DAY, 2); // advance by one day
  await rateOracleTest.writeOracleEntry();
  // await compoundRateOracleTest.writeOracleEntry();

  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_WEEK.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

  const UNDERLYING_YIELD_BEARING_PROTOCOL_AAVE =
    await rateOracleTest.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();
  const UNDERLYING_YIELD_BEARING_PROTOCOL_COMPOUND =
    await compoundRateOracleTest.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

  // set master fcm for aave and compound
  await factory.setMasterFCM(
    fcmMasterTest.address,
    UNDERLYING_YIELD_BEARING_PROTOCOL_AAVE
  );
  await factory.setMasterFCM(
    fcmMasterCompound.address,
    UNDERLYING_YIELD_BEARING_PROTOCOL_COMPOUND
  );

  // deploy a margin engine & vamm
  const deployTrx = await factory.deployIrsInstance(
    token.address,
    rateOracleTest.address,
    termStartTimestampBN,
    termEndTimestampBN,
    TICK_SPACING,
    { gasLimit: 10000000 }
  );
  let receiptLogs = (await deployTrx.wait()).logs;
  // console.log("receiptLogs", receiptLogs);
  let log = factory.interface.parseLog(receiptLogs[receiptLogs.length - 3]);
  if (log.name !== "IrsInstance") {
    throw Error(
      "IrsInstance log not found. Has it moved to a different position in the array?"
    );
  }
  // console.log("log", log);
  let marginEngineAddress = log.args.marginEngine;
  let vammAddress = log.args.vamm;
  let fcmAddress = log.args.fcm;

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

  const deployTrxCompound = await factory.deployIrsInstance(
    token.address,
    compoundRateOracleTest.address,
    termStartTimestampBN,
    termEndTimestampBN,
    TICK_SPACING
  );

  receiptLogs = (await deployTrxCompound.wait()).logs;
  // console.log("receiptLogs", receiptLogs);
  log = factory.interface.parseLog(receiptLogs[receiptLogs.length - 3]);
  if (log.name !== "IrsInstance") {
    throw Error(
      "IrsInstance log not found. Has it moved to a different position in the array?"
    );
  }
  // console.log("log", log);
  marginEngineAddress = log.args.marginEngine;
  vammAddress = log.args.vamm;
  fcmAddress = log.args.fcm;

  const marginEngineCompound = marginEngineTestFactory.attach(
    marginEngineAddress
  ) as TestMarginEngine;

  const vammCompound = vammTestFactory.attach(vammAddress) as TestVAMM;

  const fcmTestFactoryCompound = await ethers.getContractFactory("CompoundFCM");
  const fcmCompound = fcmTestFactoryCompound.attach(fcmAddress) as CompoundFCM;

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
    compoundRateOracleTest,
    mockCToken,
    marginEngineTest,
    marginEngineCompound,
    vammTest,
    vammCompound,
    fcmTest,
    fcmCompound,
  };
};

interface MetaFixtureScenario1E2E {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
  rateOracleTest: TestRateOracle;
  aaveLendingPool: MockAaveLendingPool;
  compoundRateOracleTest: TestCompoundRateOracle;
  mockCToken: MockCToken;
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

    const cToken = (await mockERC20Fixture()).token;
    const { mockCToken } = await mockCTokenFixture(token.address);
    const { compoundRateOracleTest } = await compoundRateOracleTestFixture(
      cToken.address,
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
      mockCToken,
      compoundRateOracleTest,
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

  aaveLendingPool: MockAaveLendingPool;

  rateOracleTest: TestRateOracle;

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
    await advanceTimeAndBlock(consts.ONE_MONTH.mul(6), 2); // advance by one month

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

interface CompoundMetaFixtureE2E {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;

  token: ERC20Mock;
  mockCToken: MockCToken;

  compoundRateOracleTest: TestCompoundRateOracle;

  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;

  testMarginCalculator: MarginCalculatorTest;
}

export const createCompoundMetaFixtureE2E = async function (
  e2eParams: e2eParameters
) {
  const metaFixtureE2E = async function (): Promise<CompoundMetaFixtureE2E> {
    const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
    const { vammMasterTest } = await vammMasterTestFixture();
    const { fcmMasterCompound } = await fcmMasterTestFixture();
    const { factory } = await factoryFixture(
      marginEngineMasterTest.address,
      vammMasterTest.address
    );
    const { token } = await mockERC20Fixture();

    const { mockCToken } = await mockCTokenFixture(token.address);
    await mockCToken.setExchangeRate(BigNumber.from(10).pow(20).mul(2000000));

    const { compoundRateOracleTest } = await compoundRateOracleTestFixture(
      mockCToken.address,
      token.address
    );
    await compoundRateOracleTest.increaseObservationCardinalityNext(100);

    await compoundRateOracleTest.writeOracleEntry();

    await advanceTimeAndBlock(consts.ONE_MONTH.mul(6), 4);

    await mockCToken.setExchangeRate(BigNumber.from(10).pow(20).mul(2000010));
    await compoundRateOracleTest.writeOracleEntry();

    const { testMarginCalculator } = await marginCalculatorFixture();

    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + e2eParams.duration.toNumber();
    const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
    const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

    const UNDERLYING_YIELD_BEARING_PROTOCOL_ID =
      await compoundRateOracleTest.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

    // set master fcm for aave
    await factory.setMasterFCM(
      fcmMasterCompound.address,
      UNDERLYING_YIELD_BEARING_PROTOCOL_ID
    );

    return {
      factory,
      vammMasterTest,
      marginEngineMasterTest,
      token,
      mockCToken,
      compoundRateOracleTest,
      termStartTimestampBN,
      termEndTimestampBN,
      testMarginCalculator,
    };
  };

  return metaFixtureE2E;
};
