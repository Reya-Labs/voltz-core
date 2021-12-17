import { Factory } from "../../typechain/Factory";
import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { TestVAMM } from '../../typechain/TestVAMM';
import { TestAMM } from '../../typechain/TestAMM';
import { TestMarginEngine } from '../../typechain/TestMarginEngine';
import { TestVAMMCallee } from '../../typechain/TestVAMMCallee';
import { TestMarginEngineCallee } from '../../typechain/TestMarginEngineCallee';
// import { TestERC20 } from '../../typechain/TestERC20'
import { TestDeployer } from '../../typechain/TestDeployer';
import { BigNumber } from "@ethersproject/bignumber";


interface FactoryFixture {
  factory: Factory;
}

async function factoryFixture(): Promise<FactoryFixture> {

  const fixedAndVariableMathFactory = await ethers.getContractFactory(
    "FixedAndVariableMath"
  );

  const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy());

  const TickFactory = await ethers.getContractFactory(
    "Tick"
  );

  const tick = (await TickFactory.deploy());

  const PositionFactory = await ethers.getContractFactory(
    "Position"
  );

  const position = (await PositionFactory.deploy());

  const factoryFactory = await ethers.getContractFactory(
    "Factory", {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        Tick: tick.address,
        Position: position.address
      }
    }
  );
  const factory = (await factoryFactory.deploy()) as Factory;
  return { factory };
}


interface VAMMFixture extends FactoryFixture {
  vammCalleeTest: TestVAMMCallee;
  createVAMM(
      ammAddress: string
  ): Promise<TestVAMM>
}

interface MarginEngineFixture extends FactoryFixture {
  marginEngineCalleeTest: TestMarginEngineCallee;
  createMarginEngine(
      ammAddress: string
  ): Promise<TestMarginEngine>
}

export const vammFixture: Fixture<VAMMFixture> = async function (): Promise<VAMMFixture> {

    const { factory } = await factoryFixture();
    const deployerTestFactory = await ethers.getContractFactory('TestDeployer');
    const vammTestFactory = await ethers.getContractFactory('TestVAMM');
    const testVAMMCalleeFactory = await ethers.getContractFactory('TestVAMMCallee');

    const vammCalleeTest = (await testVAMMCalleeFactory.deploy()) as TestVAMMCallee;

    return {
        factory,
        vammCalleeTest,
        createVAMM: async (ammAddress: string) => {
            const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;
            const tx = await deployerTest.deployVAMM(
                // factory.address,
                ammAddress
            )
            const receipt = await tx.wait();
            const vammAddress = receipt.events?.[0].args?.vamm as string;
            return vammTestFactory.attach(vammAddress) as TestVAMM;
        }

    }
}

export const marginEngineFixture: Fixture<MarginEngineFixture> = async function (): Promise<MarginEngineFixture> {
  
  const { factory } = await factoryFixture();
  const deployerTestFactory = await ethers.getContractFactory('TestDeployer');
  const marginEngineTestFactory = await ethers.getContractFactory('TestMarginEngine');
  const testMarginEngineCalleeFactory = await ethers.getContractFactory("TestMarginEngineCallee");

  const marginEngineCalleeTest = (await testMarginEngineCalleeFactory.deploy()) as TestMarginEngineCallee;

  return {
    factory,
    marginEngineCalleeTest,
    createMarginEngine: async (ammAddress: string) => {
      const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;
      const tx = await deployerTest.deployMarginEngine(
        // factory.address,
        ammAddress
      );
      const receipt = await tx.wait();
      const marginEngineAddress = receipt.events?.[0].args?.marginEngine as string;
      return marginEngineTestFactory.attach(marginEngineAddress) as TestMarginEngine;
    }
  }

}


interface AMMFixture extends FactoryFixture {
  createAMM(
      underlyingToken: string,
      rateOracleId: string,
      termStartTimestamp: BigNumber,
      termEndTimestamp: BigNumber
  ): Promise<TestAMM>
}


export const ammFixture: Fixture<AMMFixture> = async function (): Promise<AMMFixture> {
  const { factory } = await factoryFixture();
  const deployerTestFactory = await ethers.getContractFactory('TestDeployer');
  const ammTestFactory = await ethers.getContractFactory('TestAMM');
  // const testAMMCalleeFactory = await ethers.getContractFactory('TestAMMCallee');
  // todo: override so that the TestAMM is attached to the TestVAMM
  // const ammCalleeTest = (await testAMMCalleeFactory.deploy()) as TestAMMCallee;
  return {
    factory,
    createAMM: async (underlyingToken: string, rateOracleId: string, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber) => {
      const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;
      const tx = await deployerTest.deployAMM(
        factory.address,
        underlyingToken,
        rateOracleId,
        termStartTimestamp,
        termEndTimestamp
      );
      const receipt = await tx.wait();
      const ammAddress = receipt.events?.[0].args?.amm as string;
      return ammTestFactory.attach(ammAddress) as TestAMM;
    }
  }
}


// async function dependencyDeploymentAddresses() {
//    // linking
//   const fixedAndVariableMathFactory = await ethers.getContractFactory(
//     "FixedAndVariableMath"
//   );

//   const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

//   const TickFactory = await ethers.getContractFactory(
//     "Tick"
//   );

//   const tick = (await TickFactory.deploy());

//   const PositionFactory = await ethers.getContractFactory(
//     "Position"
//   );

//   const position = (await PositionFactory.deploy());

//   return (fixedAndVariableMath.address, tick.address, position.address)

// }