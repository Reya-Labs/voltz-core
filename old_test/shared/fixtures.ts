import { AMMFactory } from "../../typechain";
import { Fixture } from "ethereum-waffle";
import { ethers } from "hardhat";
import { TestAMMCallee } from "../../typechain/TestAMMCallee";
import { MockTimeAMM } from "../../typechain/MockTimeAMM";
import { MockTimeAMMDeployer } from "../../typechain/MockTimeAMMDeployer";

interface FactoryFixture {
  factory: AMMFactory;
}

async function factoryFixture(): Promise<FactoryFixture> {
  const factoryFactory = await ethers.getContractFactory("AMMFactory");
  const factory = (await factoryFactory.deploy()) as AMMFactory;
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

    const MockTimeAMMDeployerFactory = await ethers.getContractFactory(
      "MockTimeAMMDeployer"
    );
    const MockTimeAMMFactory = await ethers.getContractFactory("MockTimeAMM");

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
        const mockTimeAMMDeployer =
          (await MockTimeAMMDeployerFactory.deploy()) as MockTimeAMMDeployer;
        const tx = await mockTimeAMMDeployer.deploy(
          factory.address,
          underlyingToken,
          underlyingPool,
          termEndTimestamp,
          fee,
          tickSpacing
        );

        const receipt = await tx.wait();
        const ammAddress = receipt.events?.[0].args?.amm as string;
        return MockTimeAMMFactory.attach(ammAddress) as MockTimeAMM;
      },
    };
  };
