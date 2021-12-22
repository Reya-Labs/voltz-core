import { Factory } from "../../typechain/Factory";
import { Fixture } from "ethereum-waffle";
import { TestVAMM } from "../../typechain/TestVAMM";
import { TestAMM } from "../../typechain/TestAMM";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import { TestVAMMCallee } from "../../typechain/TestVAMMCallee";
import { TestMarginEngineCallee } from "../../typechain/TestMarginEngineCallee";
// import { TestERC20 } from '../../typechain/TestERC20'
import { TestDeployer } from "../../typechain/TestDeployer";
import { BigNumber } from "@ethersproject/bignumber";
import { FixedAndVariableMath } from "../../typechain";
import { consts } from "../helpers/constants";
import { ethers, waffle } from "hardhat";
import { getCurrentTimestamp } from "../helpers/time";
import { RATE_ORACLE_ID } from "./utilities";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { toBn } from "evm-bn";
import { aave_lending_pool_addr } from "./constants";
const { provider } = waffle;

interface FactoryFixture {
  factory: Factory;
}

async function marginCalculatorFixture() {

  const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
  const { time } = await timeFixture();

  const TestMarginCalculatorFactory = await ethers.getContractFactory(
     "TestMarginCalculator",
     {
       libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        Time: time.address
       }
     }
  );
  const testMarginCalculator = await TestMarginCalculatorFactory.deploy();

  return { testMarginCalculator };
}

async function rateOracleFixture() {

  const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
  const { time } = await timeFixture();

  const TestRateOracleFactory = await ethers.getContractFactory(
    "TestRateOracle",
    {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        Time: time.address
      }
    }
  );

  const testRateOracle = await TestRateOracleFactory.deploy(aave_lending_pool_addr, RATE_ORACLE_ID);

  return { testRateOracle };

}


async function vammHelpersFixture() {
  const { fixedAndVariableMath } = await fixedAndVariableMathFixture();

  const VAMMHelpersFactory = await ethers.getContractFactory("VAMMHelpers", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
    },
  });

  const vammHelpers = await VAMMHelpersFactory.deploy();

  return { vammHelpers };
}

async function positionFixture() {
  // : Promise<PositionFixture> {

  const PositionFactory = await ethers.getContractFactory("Position");

  const position = await PositionFactory.deploy();

  return { position };
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

async function marginEngineHelpersFixture() {
  const { time } = await timeFixture();

  const MarginEngineHelpersFactory = await ethers.getContractFactory(
    "MarginEngineHelpers",
    {
      libraries: {
        Time: time.address,
      },
    }
  );

  const marginEngineHelpers = await MarginEngineHelpersFactory.deploy();

  return { marginEngineHelpers };
}

async function timeFixture() {
  const TimeFactory = await ethers.getContractFactory("Time");

  const time = await TimeFactory.deploy();

  return { time };
}

async function fixedAndVariableMathFixture() {
  const { time } = await timeFixture();

  const fixedAndVariableMathFactory = await ethers.getContractFactory(
    "FixedAndVariableMath",
    {
      libraries: {
        Time: time.address,
      },
    }
  );

  const fixedAndVariableMath =
    (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

  return { fixedAndVariableMath };
}

async function factoryFixture(): Promise<FactoryFixture> {
  // const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
  // const { tick } = await tickFixture();
  // const { position } = await positionFixture();
  const { time } = await timeFixture();

  const factoryFactory = await ethers.getContractFactory("Factory", {
    libraries: {
      Time: time.address,
      // FixedAndVariableMath: fixedAndVariableMath.address,
      // Tick: tick.address,
      // Position: position.address
    },
  });
  const factory = (await factoryFactory.deploy()) as Factory;
  return { factory };
}

interface VAMMFixture extends FactoryFixture {
  vammCalleeTest: TestVAMMCallee;
  createVAMM(ammAddress: string): Promise<TestVAMM>;
}

interface MarginEngineFixture extends FactoryFixture {
  marginEngineCalleeTest: TestMarginEngineCallee;
  createMarginEngine(ammAddress: string): Promise<TestMarginEngine>;
}

export const vammFixture: Fixture<VAMMFixture> =
  async function (): Promise<VAMMFixture> {
    const { factory } = await factoryFixture();
    const { time } = await timeFixture();
    const { tick } = await tickFixture();
    const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
    const { marginEngineHelpers } = await marginEngineHelpersFixture();
    const { unwindTraderUnwindPosition } =
      await unwindTraderUnwinPositionFixture();
    const { vammHelpers } = await vammHelpersFixture();

    const deployerTestFactory = await ethers.getContractFactory(
      "TestDeployer",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Tick: tick.address,
          Time: time.address,
          MarginEngineHelpers: marginEngineHelpers.address,
          UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
          VAMMHelpers: vammHelpers.address,
        },
      }
    );

    const vammTestFactory = await ethers.getContractFactory("TestVAMM", {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        Tick: tick.address,
        Time: time.address,
        VAMMHelpers: vammHelpers.address,
      },
    });

    const testVAMMCalleeFactory = await ethers.getContractFactory(
      "TestVAMMCallee"
    );

    const vammCalleeTest =
      (await testVAMMCalleeFactory.deploy()) as TestVAMMCallee;

    return {
      factory,
      vammCalleeTest,
      createVAMM: async (ammAddress: string) => {
        const deployerTest =
          (await deployerTestFactory.deploy()) as TestDeployer;
        const tx = await deployerTest.deployVAMM(
          // factory.address,
          ammAddress
        );
        const receipt = await tx.wait();
        const vammAddress = receipt.events?.[0].args?.vammAddress as string;
        return vammTestFactory.attach(vammAddress) as TestVAMM;
      },
    };
  };

export const marginEngineFixture: Fixture<MarginEngineFixture> =
  async function (): Promise<MarginEngineFixture> {
    const { factory } = await factoryFixture();
    const { time } = await timeFixture();
    const { tick } = await tickFixture();
    const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
    const { marginEngineHelpers } = await marginEngineHelpersFixture();
    const { unwindTraderUnwindPosition } =
      await unwindTraderUnwinPositionFixture();
    const { vammHelpers } = await vammHelpersFixture();

    const deployerTestFactory = await ethers.getContractFactory(
      "TestDeployer",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Tick: tick.address,
          Time: time.address,
          MarginEngineHelpers: marginEngineHelpers.address,
          UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
          VAMMHelpers: vammHelpers.address,
        },
      }
    );
    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Time: time.address,
          MarginEngineHelpers: marginEngineHelpers.address,
          UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
        },
      }
    );
    const testMarginEngineCalleeFactory = await ethers.getContractFactory(
      "TestMarginEngineCallee"
    );

    const marginEngineCalleeTest =
      (await testMarginEngineCalleeFactory.deploy()) as TestMarginEngineCallee;

    return {
      factory,
      marginEngineCalleeTest,
      createMarginEngine: async (ammAddress: string) => {
        const deployerTest =
          (await deployerTestFactory.deploy()) as TestDeployer;
        const tx = await deployerTest.deployMarginEngine(
          // factory.address,
          ammAddress
        );
        const receipt = await tx.wait();
        const marginEngineAddress = receipt.events?.[0].args
          ?.marginEngineAddress as string;
        return marginEngineTestFactory.attach(
          marginEngineAddress
        ) as TestMarginEngine;
      },
    };
  };

interface AMMFixture extends FactoryFixture {
  createAMM(
    underlyingToken: string,
    rateOracleId: string,
    termStartTimestamp: BigNumber,
    termEndTimestamp: BigNumber
  ): Promise<TestAMM>;
}

export const ammFixture: Fixture<AMMFixture> =
  async function (): Promise<AMMFixture> {
    const { factory } = await factoryFixture();
    const { time } = await timeFixture();
    const { tick } = await tickFixture();
    const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
    const { marginEngineHelpers } = await marginEngineHelpersFixture();
    const { unwindTraderUnwindPosition } =
      await unwindTraderUnwinPositionFixture();
    const { vammHelpers } = await vammHelpersFixture();

    const deployerTestFactory = await ethers.getContractFactory(
      "TestDeployer",
      {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address,
          Tick: tick.address,
          Time: time.address,
          MarginEngineHelpers: marginEngineHelpers.address,
          UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
          VAMMHelpers: vammHelpers.address,
        },
      }
    );
    const ammTestFactory = await ethers.getContractFactory("TestAMM");
    // const testAMMCalleeFactory = await ethers.getContractFactory('TestAMMCallee');
    // todo: override so that the TestAMM is attached to the TestVAMM
    // const ammCalleeTest = (await testAMMCalleeFactory.deploy()) as TestAMMCallee;
    return {
      factory,
      createAMM: async (
        underlyingToken: string,
        rateOracleId: string,
        termStartTimestamp: BigNumber,
        termEndTimestamp: BigNumber
      ) => {
        const deployerTest =
          (await deployerTestFactory.deploy()) as TestDeployer;
        const tx = await deployerTest.deployAMM(
          factory.address,
          underlyingToken,
          rateOracleId,
          termStartTimestamp,
          termEndTimestamp
        );
        const receipt = await tx.wait();
        const ammAddress = receipt.events?.[0].args?.ammAddress as string;

        return ammTestFactory.attach(ammAddress) as TestAMM;
      },
    };
  };

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
}

export const metaFixture = async function (): Promise<MetaFixture> {
  // deploy the amm
  // deploy the vamm
  // deploy the margin engine
  // set the margin engine in the amm, set the vamm in the amm

  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number =
    termStartTimestamp + consts.ONE_DAY.toNumber();
  const termStartTimestampBN: BigNumber = toBn(termStartTimestamp.toString());
  const termEndTimestampBN: BigNumber = toBn(termEndTimestamp.toString());

  console.log("Test: Term Start Timestamp is: ", termStartTimestampBN.toString());
  console.log("Test: Term End Timestamp is: ", termEndTimestampBN.toString());

  const { factory } = await factoryFixture();
  const { time } = await timeFixture();
  const { tick } = await tickFixture();
  const { fixedAndVariableMath } = await fixedAndVariableMathFixture();
  const { marginEngineHelpers } = await marginEngineHelpersFixture();
  const { unwindTraderUnwindPosition } =
    await unwindTraderUnwinPositionFixture();
  const { vammHelpers } = await vammHelpersFixture();
  const { testRateOracle } = await rateOracleFixture();
  const { testMarginCalculator } = await marginCalculatorFixture();
  
  // set the rate for termStartTimestamp
  await testRateOracle.setTermStartTimestampRate(mainnetConstants.tokens.USDC.address, termStartTimestampBN);
  
  // add a mock rate oracle to the factory
  await factory.addRateOracle(RATE_ORACLE_ID, testRateOracle.address);

  // set the margin calculator
  await factory.setCalculator(testMarginCalculator.address);

  // set the rate for termStartTimestamp in the test rate oracle
  
  const deployerTestFactory = await ethers.getContractFactory("TestDeployer", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
      Tick: tick.address,
      Time: time.address,
      MarginEngineHelpers: marginEngineHelpers.address,
      UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
      VAMMHelpers: vammHelpers.address,
    },
  });

  const ammTestFactory = await ethers.getContractFactory("TestAMM");

  // create the amm

  const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;
  let tx = await deployerTest.deployAMM(
    factory.address,
    mainnetConstants.tokens.USDC.address,
    RATE_ORACLE_ID,
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
        Time: time.address,
        MarginEngineHelpers: marginEngineHelpers.address,
        UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address,
      },
    }
  );

  const testMarginEngineCalleeFactory = await ethers.getContractFactory(
    "TestMarginEngineCallee"
  );

  const marginEngineCalleeTest =
    (await testMarginEngineCalleeFactory.deploy()) as TestMarginEngineCallee;

  tx = await deployerTest.deployMarginEngine(
    // factory.address,
    ammAddress
  );

  receipt = await tx.wait();

  const marginEngineAddress = receipt.events?.[0].args
    ?.marginEngineAddress as string;

  const marginEngineTest = marginEngineTestFactory.attach(
    marginEngineAddress
  ) as TestMarginEngine;

  // link the margin engine to the AMM
  await ammTest.setMarginEngine(marginEngineAddress);

  // create the vamm
  const vammTestFactory = await ethers.getContractFactory("TestVAMM", {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
      Tick: tick.address,
      Time: time.address,
      VAMMHelpers: vammHelpers.address,
    },
  });

  const testVAMMCalleeFactory = await ethers.getContractFactory(
    "TestVAMMCallee"
  );

  const vammCalleeTest =
    (await testVAMMCalleeFactory.deploy()) as TestVAMMCallee;

  tx = await deployerTest.deployVAMM(
    // factory.address,
    ammAddress
  );

  receipt = await tx.wait();

  const vammAddress = receipt.events?.[0].args?.vammAddress as string;

  const vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

  // link the vamm to the amm
  await ammTest.setVAMM(vammAddress);

  return {
    factory,
    ammTest,
    vammTest,
    marginEngineTest,
    vammCalleeTest,
    marginEngineCalleeTest,
  };
};
