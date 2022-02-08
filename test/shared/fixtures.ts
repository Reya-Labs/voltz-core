import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { BigNumber } from "@ethersproject/bignumber";
import { TestRateOracle } from "../../typechain/TestRateOracle";

import {
  ERC20Mock,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  SqrtPriceMathTest,
  TickMathTest,
} from "../../typechain";

import { consts } from "../helpers/constants";

import { ethers, waffle } from "hardhat";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";

import { toBn } from "evm-bn";
const { provider } = waffle;

export async function mockERC20Fixture() {
  const MockERC20Factory = await ethers.getContractFactory("ERC20Mock");

  const token = (await MockERC20Factory.deploy(
    "Voltz USD",
    "VUSD",
    6
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
}

export const metaFixture = async function (): Promise<MetaFixture> {
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

  await aaveLendingPool.setReserveNormalizedIncome(
    token.address,
    BigNumber.from(1).pow(27)
  );

  await rateOracleTest.increaseObservarionCardinalityNext(5);
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

  return {
    factory,
    vammMasterTest,
    marginEngineMasterTest,
    token,
    rateOracleTest,
    aaveLendingPool,
    termStartTimestampBN,
    termEndTimestampBN,
  };
};

interface MetaFixtureE2E {
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
  async function (): Promise<MetaFixtureE2E> {
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

    await rateOracleTest.increaseObservarionCardinalityNext(100);
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
