import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IAaveV2LendingPool } from "../../typechain";

export interface Datum {
  blockNumber: number;
  timestamp: number;
  rate: BigNumber;
  error: unknown;
}

export interface BlockSpec {
  fromBlock: number; // positive value = absolute block number; negative = offset from toBlock
  blockInterval: number;
  toBlock: number; //
}
export interface AaveDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  lendingPool: IAaveV2LendingPool;
  underlyingAddress: string;
  borrow: boolean;
}

const blocksPerDay = 5 * 60 * 24; // 12 seconds per block = 5 blocks per minute

// Generator function for Aave data
async function* aaveDataGenerator(spec: AaveDataSpec): AsyncGenerator<Datum> {
  const { hre, underlyingAddress, lendingPool } = spec;
  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);
      let rate: BigNumber;

      if (spec.borrow) {
        rate = await lendingPool.getReserveNormalizedVariableDebt(
          underlyingAddress,
          { blockTag: b }
        );
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

export async function mainnetAaveDataGenerator(
  hre: HardhatRuntimeEnvironment,
  underlyingAddress: string,
  lookbackDays?: number,
  borrow = false,
  overrides?: Partial<AaveDataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  const defaults = {
    fromBlock: lookbackDays
      ? currentBlock.number - blocksPerDay * lookbackDays
      : 11367585, // 11367585 = lending pool deploy block on mainnet
    blockInterval: blocksPerDay,
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
