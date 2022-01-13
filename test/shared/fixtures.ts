import { Factory } from "../../typechain/Factory";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestAMM } from "../../typechain/TestAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
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

interface FactoryFixture {
  factory: Factory;
}

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

  const testMarginCalculator = await TestMarginCalculatorFactory.deploy(
    factoryAddress
  );

  return { testMarginCalculator };
}

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

  return { vammHelpers };
}

async function tickFixture() {
  const TickFactory = await ethers.getContractFactory("Tick");

  const tick = await TickFactory.deploy();

  return { tick };
}

async function unwindTraderUnwinPositionFixture() {
  const UnwindTraderUnwindPositionFactory = await ethers.getContractFactory(
    "UnwindTraderUnwindPosition"
  );

  const unwindTraderUnwindPosition =
    await UnwindTraderUnwindPositionFactory.deploy();

  return { unwindTraderUnwindPosition };
}

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
}

// one fixture for everything amm/vamm/marginEngine
// the fixture needs to properly set everything
// just use onlyFactory auth for all amm, vamm and margin engine
// callees now work
// convert the amm fixture into a composite one and use it for all the tests amm, vamm and margin engine

interface MetaFixture {
  factory: Factory;
  ammTest: TestAMM;
  vammTest: TestVAMM;
  marginEngineTest: TestMarginEngine;
  vammCalleeTest: TestVAMMCallee;
  marginEngineCalleeTest: TestMarginEngineCallee;
  token: ERC20Mock;
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
  );

  const { aaveLendingPool } = await mockAaveLendingPoolFixture();
  await aaveLendingPool.setReserveNormalizedIncome(
    token.address,
    BigNumber.from(10).pow(27)
  );

  const { testRateOracle } = await rateOracleFixture(
    fixedAndVariableMath.address,
    token.address,
    aaveLendingPool.address,
    factory.address
  );

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

  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_WEEK.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

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

  return {
    factory,
    ammTest,
    vammTest,
    marginEngineTest,
    vammCalleeTest,
    marginEngineCalleeTest,
    token,
    testMarginCalculator,
    testRateOracle,
  };
};
