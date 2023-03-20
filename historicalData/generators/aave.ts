import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getAaveV2LendingPoolAddress,
  getAaveV3LendingPoolAddress,
} from "../../poolConfigs/external-contracts/aave";
import { IPool } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface AaveDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  underlyingAddress: string;
  borrow: boolean;
  version: 2 | 3;
}

// Generator function for Aave data
async function* aaveDataGenerator(spec: AaveDataSpec): AsyncGenerator<Datum> {
  const { hre, underlyingAddress } = spec;

  let lendingPool: IPool;
  switch (spec.version) {
    case 2: {
      lendingPool = (await hre.ethers.getContractAt(
        "IPool",
        getAaveV2LendingPoolAddress(hre.network.name)
      )) as IPool;
      break;
    }
    case 3: {
      lendingPool = (await hre.ethers.getContractAt(
        "IPool",
        getAaveV3LendingPoolAddress(hre.network.name)
      )) as IPool;
      break;
    }
    default: {
      throw new Error(`Unrecongized version ${spec.version} for Aave`);
    }
  }

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);
      const rate = spec.borrow
        ? await lendingPool.getReserveNormalizedVariableDebt(
            underlyingAddress,
            {
              blockTag: b,
            }
          )
        : await lendingPool.getReserveNormalizedIncome(underlyingAddress, {
            blockTag: b,
          });

      yield {
        blockNumber: b,
        timestamp: block.timestamp,
        rate,
        error: null,
      };
    } catch (e: unknown) {
      yield {
        blockNumber: b,
        timestamp: 0,
        rate: BigNumber.from(0),
        error: e,
      };
    }
  }
}

export async function buildAaveDataGenerator(
  spec: AaveDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  return aaveDataGenerator(spec);
}
