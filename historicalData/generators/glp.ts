import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IGlpManager, IRewardDistributor, IVault } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface GlpDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
}

// Generator function for Aave data
async function* glpDataGenerator(spec: GlpDataSpec): AsyncGenerator<Datum> {
  const { hre } = spec;

  const precision27 = BigNumber.from(10).pow(27);
  const precision18 = BigNumber.from(10).pow(18);
  let lastIndex: BigNumber = precision27;
  let previousBlock = await hre.ethers.provider.getBlock(
    spec.fromBlock - spec.blockInterval
  );
  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);

      const glpManager = (await hre.ethers.getContractAt(
        "IGlpManager",
        "0x321F653eED006AD1C29D174e17d96351BDe22649" // arbitrum reward tracker address
      )) as IGlpManager;

      const vault = (await hre.ethers.getContractAt(
        "IVault",
        "0x489ee077994B6658eAfA855C308275EAd8097C4A" // arbitrum reward tracker address
      )) as IVault;

      const distributor = (await hre.ethers.getContractAt(
        "IRewardDistributor",
        "0x5C04a12EB54A093c396f61355c6dA0B15890150d" // arbitrum reward tracker address
      )) as IRewardDistributor;

      const aumUsd = await glpManager.getAum(false, {
        blockTag: b,
      });
      const ethPrice = await vault.getMinPrice(
        "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        {
          blockTag: b,
        }
      );

      const weeklyReward = await distributor.tokensPerInterval({
        blockTag: b,
      });

      const timeDelta = block.timestamp - previousBlock.timestamp;
      previousBlock = block;
      const rate = weeklyReward.mul(timeDelta).div(aumUsd.div(ethPrice));

      if (rate.lte(0)) {
        throw new Error("Rate is 0");
      }

      lastIndex = lastIndex
        .mul(rate.add(precision18).mul(precision27).div(precision18))
        .div(precision27);

      yield {
        blockNumber: b,
        timestamp: block.timestamp,
        rate: lastIndex,
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

export async function buildGlpDataGenerator(
  hre: HardhatRuntimeEnvironment,
  lookbackDays?: number,
  overrides?: Partial<GlpDataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const blocksPerDay = 86400;

  const defaults = {
    fromBlock: lookbackDays
      ? currentBlock - blocksPerDay * lookbackDays
      : 19664221, // 8th of August
    blockInterval: blocksPerDay, // 86400 - 1 day in seconds
    toBlock: currentBlock,
    hre,
  };

  return glpDataGenerator({
    ...defaults,
    ...overrides,
  });
}
