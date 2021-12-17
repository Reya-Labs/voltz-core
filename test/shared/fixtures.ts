



import { Factory } from "../../typechain/Factory";
import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { TestVAMM } from '../typechain/TestVAMM';
import { TestVAMMCallee } from '../typechain/TestVAMMCallee';
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
  testVAMMCallee: TestVAMMCallee;
  createVAMM(
      ammAddress: string
  ): Promise<TestVAMM>
}

export const vammFixture: Fixture<VAMMFixture> = async function (): Promise<VAMMFixture> {

    const { factory } = await factoryFixture();
    const deployerTestFactory = await ethers.getContractFactory('TestDeployer');
    const vammTestFactory = await ethers.getContractFactory('TestVAMM');
    const testVAMMCalleeFactory = await ethers.getContractFactory('TestVAMMCallee');

    const testVAMMCallee = (await testVAMMCalleeFactory.deploy()) as TestVAMMCallee;

    return {
        factory,
        testVAMMCallee,
        createVAMM: async (ammAddress) => {
            const deployerTest = (await deployerTestFactory.deploy()) as TestDeployer;
            const tx = await deployerTest.deployVAMM(
                factory.address,
                ammAddress
            )
            const receipt = await tx.wait();
            const vammAddress = receipt.events?.[0].args?.vamm as string;
            return vammTestFactory.attach(vammAddress) as TestVAMM;

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