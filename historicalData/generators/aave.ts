import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IPool } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface AaveDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  lendingPoolAddress: string;
  underlyingAddress: string;
  borrow: boolean;
}

// Generator function for Aave data
async function* aaveDataGenerator(spec: AaveDataSpec): AsyncGenerator<Datum> {
  const { hre, underlyingAddress, lendingPoolAddress } = spec;

  const lendingPool = (await hre.ethers.getContractAt(
    "IPool",
    lendingPoolAddress
  )) as IPool;

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
