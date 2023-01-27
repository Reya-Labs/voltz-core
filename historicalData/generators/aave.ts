import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IAaveV2LendingPool, IAaveV3LendingPool } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface AaveV2DataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  lendingPool: IAaveV2LendingPool;
  underlyingAddress: string;
  borrow: boolean;
}

export interface AaveV3DataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  lendingPool: IAaveV3LendingPool;
  underlyingAddress: string;
  borrow: boolean;
}

// Generator function for Aave data
async function* aaveDataGenerator(
  spec: AaveV2DataSpec | AaveV3DataSpec
): AsyncGenerator<Datum> {
  const { hre, underlyingAddress, lendingPool } = spec;
  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);
      let rate: BigNumber;

      if (spec.borrow) {
        rate = BigNumber.from(0);
        await (
          lendingPool as IAaveV2LendingPool
        ).getReserveNormalizedVariableDebt(underlyingAddress, { blockTag: b });
      } else {
        rate = await lendingPool.getReserveNormalizedIncome(underlyingAddress, {
          blockTag: b,
        });
      }
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
  hre: HardhatRuntimeEnvironment,
  underlyingAddress: string,
  lookbackDays?: number,
  borrow = false,
  overrides?: Partial<AaveV2DataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  // const defaults = {
  //   fromBlock: lookbackDays
  //     ? currentBlock.number - blocksPerDay * lookbackDays
  //     : lendingPoolDeploymentBlock, // lending pool deploy block on mainnet
  //   blockInterval: blocksPerDay,
  //   toBlock: currentBlock.number,
  //   hre,
  //   underlyingAddress,
  //   borrow,
  //   lendingPool,
  // };

  const defaults = {
    fromBlock: 16497500,
    blockInterval: 300,
    toBlock: currentBlock.number,
    hre,
    underlyingAddress,
    borrow,
    lendingPool: (await hre.ethers.getContractAt(
      "IAaveV2LendingPool",
      "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9" // mainnet lending pool address
    )) as IAaveV2LendingPool,
  };

  return aaveDataGenerator({
    ...defaults,
    ...overrides,
  });
}

export async function buildAaveV3DataGenerator(
  hre: HardhatRuntimeEnvironment,
  lendingPool: IAaveV2LendingPool | IAaveV3LendingPool,
  underlyingAddress: string,
  borrow = false,
  overrides?: Partial<AaveV3DataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  const defaults = {
    fromBlock: 16497500,
    blockInterval: 300,
    toBlock: currentBlock.number,
    hre,
    underlyingAddress,
    borrow,
    lendingPool,
  };

  return aaveDataGenerator({
    ...defaults,
    ...overrides,
  });
}
