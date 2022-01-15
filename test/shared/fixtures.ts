import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
<<<<<<< HEAD
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
import { TestDeployer } from "../../typechain/TestDeployer";
import { TestRateOracle } from "../../typechain/TestRateOracle";
import { BigNumber } from "@ethersproject/bignumber";
import {
  ERC20Mock,
  FixedAndVariableMath,
  MarginCalculatorTest,
} from "../../typechain";
import { consts } from "../helpers/constants";
import { ethers, waffle } from "hardhat";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  MAX_LEVERAGE,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
  getMaxLiquidityPerTick,
  TICK_SPACING,
} from "./utilities";
import { toBn } from "evm-bn";
const { provider } = waffle;
=======
import { BigNumber } from "@ethersproject/bignumber";
import { TestRateOracle } from "../../typechain/TestRateOracle";
>>>>>>> ammRefactoring

import { ERC20Mock } from "../../typechain";

<<<<<<< HEAD
export async function marginCalculatorFixture(
  fixedAndVariableMathAddress: string,
  factoryAddress: string
) {
  const TestMarginCalculatorFactory = await ethers.getContractFactory(
    "MarginCalculatorTest",
    {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMathAddress,
      },
    }
  );
=======
import { consts } from "../helpers/constants";
>>>>>>> ammRefactoring

import { ethers, waffle } from "hardhat";
import { getCurrentTimestamp } from "../helpers/time";

import { toBn } from "evm-bn";
const { provider } = waffle;

export async function mockERC20Fixture() {
  const MockERC20Factory = await ethers.getContractFactory("ERC20Mock");

  const token = await MockERC20Factory.deploy("Voltz USD", "VUSD", 6);

  return { token };
}

export async function mockAaveLendingPoolFixture() {
  const MockAaveLendingPoolFactory = await ethers.getContractFactory(
    "MockAaveLendingPool"
  );

  const aaveLendingPool = await MockAaveLendingPoolFactory.deploy();

  return { aaveLendingPool };
}

<<<<<<< HEAD
export async function rateOracleFixture(
  fixedAndVariableMathAddress: string,
  tokenAddress: string,
  aaveLendingPoolAddress: string,
  factoryAddress: string
) {
  const TestRateOracleFactory = await ethers.getContractFactory(
    "TestRateOracle",
    {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMathAddress,
      },
    }
  );

  console.log(
    "Test TS: Aave lending pool address is: ",
    aaveLendingPoolAddress
  );

  const testRateOracle = await TestRateOracleFactory.deploy(
    aaveLendingPoolAddress,
    tokenAddress,
    factoryAddress
  );

  return { testRateOracle };
}

async function vammHelpersFixture(fixedAndVariableMathAddress: string) {
  const VAMMHelpersFactory = await ethers.getContractFactory("VAMMHelpers", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMathAddress,
    },
  });

  const vammHelpers = await VAMMHelpersFactory.deploy();
=======
export async function vammMasterTestFixture() {
  const vammMasterTestFactory = await ethers.getContractFactory("TestVAMM");
  const vammMasterTest = await vammMasterTestFactory.deploy();
>>>>>>> ammRefactoring

  return { vammMasterTest };
}

export async function marginEngineMasterTestFixture() {
  const marginEngineMasterTestFactory = await ethers.getContractFactory(
    "TestMarginEngine"
  );
  const marginEngineMasterTest = await marginEngineMasterTestFactory.deploy();

  return { marginEngineMasterTest };
}

<<<<<<< HEAD
export async function fixedAndVariableMathFixture() {
  const fixedAndVariableMathFactory = await ethers.getContractFactory(
    "FixedAndVariableMath"
  );

  const fixedAndVariableMath =
    (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

  return { fixedAndVariableMath };
}

export async function factoryFixture(
  fixedAndVariableMathAddress: string,
  tickAddress: string,
  unwindTraderUnwindPositionAddress: string,
  vammHelpersAddress: string
): Promise<FactoryFixture> {
  const factoryFactory = await ethers.getContractFactory("Factory", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMathAddress,
      Tick: tickAddress,
      UnwindTraderUnwindPosition: unwindTraderUnwindPositionAddress,
      VAMMHelpers: vammHelpersAddress,
    },
  });
  const factory = (await factoryFactory.deploy()) as Factory;
  return { factory };
=======
export async function factoryFixture(
  _masterMarginEngineAddress: string,
  _masterVAMMAddress: string
) {
  const factoryFactory = await ethers.getContractFactory("Factory");
  const factory = await factoryFactory.deploy(
    _masterMarginEngineAddress,
    _masterVAMMAddress
  );

  return { factory };
}

export async function rateOracleTestFixture(
  _aaveLendingPoolAddress: string,
  _underlyingAddress: string
) {
  const rateOracleTestFactory = await ethers.getContractFactory(
    "TestRateOracle"
  );
  const rateOracleTest = await rateOracleTestFactory.deploy(
    _aaveLendingPoolAddress,
    _underlyingAddress
  );

  return { rateOracleTest };
>>>>>>> ammRefactoring
}

interface MetaFixture {
  factory: Factory;
  vammMasterTest: TestVAMM;
  marginEngineMasterTest: TestMarginEngine;
  token: ERC20Mock;
<<<<<<< HEAD
  testMarginCalculator: MarginCalculatorTest;
  testRateOracle: TestRateOracle;
}

export const metaFixture = async function (): Promise<MetaFixture> {
  // create a mock token and mint some to our wallet
  const { token } = await mockERC20Fixture();
  const { tick } = await tickFixture();
  const { unwindTraderUnwindPosition } =
    await unwindTraderUnwinPositionFixture();
  const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
  const { vammHelpers } = await vammHelpersFixture(
    fixedAndVariableMath.address
  );
  const { factory } = await factoryFixture(
    fixedAndVariableMath.address,
    tick.address,
    unwindTraderUnwindPosition.address,
    vammHelpers.address
=======
  rateOracleTest: TestRateOracle;
  termStartTimestampBN: BigNumber;
  termEndTimestampBN: BigNumber;
}

export const metaFixture = async function (): Promise<MetaFixture> {
  const { marginEngineMasterTest } = await marginEngineMasterTestFixture();
  const { vammMasterTest } = await vammMasterTestFixture();
  const { factory } = await factoryFixture(
    marginEngineMasterTest.address,
    vammMasterTest.address
>>>>>>> ammRefactoring
  );
  const { token } = await mockERC20Fixture();
  const { aaveLendingPool } = await mockAaveLendingPoolFixture();
<<<<<<< HEAD
  await aaveLendingPool.setReserveNormalizedIncome(
    token.address,
    BigNumber.from(10).pow(27)
  );

  const { testRateOracle } = await rateOracleFixture(
    fixedAndVariableMath.address,
    token.address,
=======
  const { rateOracleTest } = await rateOracleTestFixture(
>>>>>>> ammRefactoring
    aaveLendingPool.address,
    token.address
  );

<<<<<<< HEAD
  console.log(`testRateOracle at ${testRateOracle.address}`);

  await testRateOracle.testGrow(10);
  await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  await testRateOracle.writeOracleEntry();
  await advanceTimeAndBlock(BigNumber.from(86400), 2); // advance by one day
  await testRateOracle.writeOracleEntry();

  // deploy the amm
  // deploy the vamm
  // deploy the margin engine
  // set the margin engine in the amm, set the vamm in the amm

=======
>>>>>>> ammRefactoring
  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_WEEK.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

<<<<<<< HEAD
  // console.log(
  //   "Test: Term Start Timestamp is: ",
  //   termStartTimestampBN.toString()
  // );
  // console.log("Test: Term End Timestamp is: ", termEndTimestampBN.toString());

  const { testMarginCalculator } = await marginCalculatorFixture(
    fixedAndVariableMath.address,
    factory.address
  );

  // set marign calculator parameters
  await testMarginCalculator.setMarginCalculatorParametersTest(
    testRateOracle.address,
    APY_UPPER_MULTIPLIER,
    APY_LOWER_MULTIPLIER,
    MIN_DELTA_LM,
    MIN_DELTA_IM,
    MAX_LEVERAGE,
    SIGMA_SQUARED,
    ALPHA,
    BETA,
    XI_UPPER,
    XI_LOWER,
    T_MAX
  );

  // set the margin calculator
  await factory.setCalculator(testMarginCalculator.address);

  const deployerTestFactory = await ethers.getContractFactory("TestDeployer", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
      Tick: tick.address,
      UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
      VAMMHelpers: vammHelpers.address,
    },
  });

  const ammTestFactory = await ethers.getContractFactory("TestAMM");

  // create the amm

  const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;

  let tx = await deployerTest.deployAMM(
    factory.address,
    token.address,
    testRateOracle.address,
    termStartTimestampBN,
    termEndTimestampBN
  );

  let receipt = await tx.wait();

  const ammAddress = receipt.events?.[0].args?.ammAddress as string;
  console.log("The AMM address is ", ammAddress);
  const ammTest = ammTestFactory.attach(ammAddress) as TestAMM;

  // create the margin engine

  const marginEngineTestFactory = await ethers.getContractFactory(
    "TestMarginEngine",
    {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
      },
    }
  );

  const testMarginEngineCalleeFactory = await ethers.getContractFactory(
    "TestMarginEngineCallee"
  );

  const marginEngineCalleeTest =
    (await testMarginEngineCalleeFactory.deploy()) as TestMarginEngineCallee;

  tx = await deployerTest.deployMarginEngine(ammAddress);

  receipt = await tx.wait();

  const marginEngineAddress = receipt.events?.[0].args
    ?.marginEngineAddress as string;

  console.log(`marginEngineTest at ${marginEngineAddress}`);

  const marginEngineTest = marginEngineTestFactory.attach(
    marginEngineAddress
  ) as TestMarginEngine;
  await marginEngineTest.setSecondsAgo("86400"); // one day

  // Grant an allowance to the MarginEngine
  await token.approve(marginEngineTest.address, BigNumber.from(10).pow(27));

  // link the margin engine to the AMM
  await ammTest.setMarginEngine(marginEngineAddress);

  // create the vamm
  const vammTestFactory = await ethers.getContractFactory("TestVAMM", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
      Tick: tick.address,
      VAMMHelpers: vammHelpers.address,
    },
  });

  const testVAMMCalleeFactory = await ethers.getContractFactory(
    "TestVAMMCallee"
  );

  const vammCalleeTest =
    (await testVAMMCalleeFactory.deploy()) as TestVAMMCallee;

  tx = await deployerTest.deployVAMM(ammAddress);

  receipt = await tx.wait();

  const vammAddress = receipt.events?.[0].args?.vammAddress as string;

  const vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

  // set key vamm parameters
  await vammTest.setFee(toBn("0.03"));
  await vammTest.setMaxLiquidityPerTick(getMaxLiquidityPerTick(TICK_SPACING));
  await vammTest.setTickSpacing(TICK_SPACING);

  // Grant allowance to the vamm
  await token.approve(vammTest.address, BigNumber.from(10).pow(27));

  // Grant allowance to the amm
  await token.approve(ammTest.address, BigNumber.from(10).pow(27));

  // link the vamm to the amm
  await ammTest.setVAMM(vammAddress);

=======
>>>>>>> ammRefactoring
  return {
    factory,
    vammMasterTest,
    marginEngineMasterTest,
    token,
<<<<<<< HEAD
    testMarginCalculator,
    testRateOracle,
=======
    rateOracleTest,
    termStartTimestampBN,
    termEndTimestampBN,
>>>>>>> ammRefactoring
  };
};
