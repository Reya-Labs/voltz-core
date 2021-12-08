import { Factory } from "../../typechain";
import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { TestAMMCallee } from "../../typechain/TestAMMCallee";
import { MockTimeAMM } from "../../typechain/MockTimeAMM";
import { MockTimeDeployer } from "../../typechain/MockTimeDeployer";

interface FactoryFixture {
  factory: Factory;
}

async function factoryFixture(): Promise<FactoryFixture> {
  const factoryFactory = await ethers.getContractFactory("Factory");
  const factory = (await factoryFactory.deploy()) as Factory;
  return { factory };
}

interface AMMFixture extends FactoryFixture {
  swapTargetCallee: TestAMMCallee;
  createAMM(
    underlyingToken: string,
    underlyingPool: string,
    termEndTimestamp: number,
    fee: number,
    tickSpacing: number
  ): Promise<MockTimeAMM>;
}

// Monday, October 5, 2020 9:00:00 AM GMT-05:00
export const TEST_AMM_START_TIME = 1601906400;

export const AMMFixture: Fixture<AMMFixture> =
  async function (): Promise<AMMFixture> {
    const { factory } = await factoryFixture();

    const MockTimeDeployerFactory = await ethers.getContractFactory(
      "MockTimeDeployer"
    );
    const MockTimeFactory = await ethers.getContractFactory("MockTimeAMM");

    const calleeContractFactory = await ethers.getContractFactory(
      "TestAMMCallee"
    );

    const swapTargetCallee =
      (await calleeContractFactory.deploy()) as TestAMMCallee;

    return {
      factory,
      swapTargetCallee,
      createAMM: async (
        underlyingToken,
        underlyingPool,
        termEndTimestamp,
        fee,
        tickSpacing
      ) => {
        const mockTimeDeployer =
          (await MockTimeDeployerFactory.deploy()) as MockTimeDeployer;
        const tx = await mockTimeDeployer.deploy(
          factory.address,
          underlyingToken,
          underlyingPool,
          termEndTimestamp,
          fee,
          tickSpacing
        );

        const receipt = await tx.wait();
        const ammAddress = receipt.events?.[0].args?.amm as string;
        return MockTimeFactory.attach(ammAddress) as MockTimeAMM;
      },
    };
  };
