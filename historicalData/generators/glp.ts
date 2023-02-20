import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ERC20, IGlpManager, IRewardTracker, IVault } from "../../typechain";
import { BlockSpec, Datum } from "./common";

const precision27 = BigNumber.from(10).pow(27);
const precision30 = BigNumber.from(10).pow(30);
const precision18 = BigNumber.from(10).pow(18);
export interface GlpDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
}

// Generator function for Aave data
async function* glpDataGenerator(spec: GlpDataSpec): AsyncGenerator<Datum> {
  const { hre } = spec;
  let lastIndex: BigNumber = BigNumber.from(0);
  const glpManager = (await hre.ethers.getContractAt(
    "IGlpManager",
    "0x321F653eED006AD1C29D174e17d96351BDe22649"
  )) as IGlpManager;

  const rewardTracker = (await hre.ethers.getContractAt(
    "IRewardTracker",
    "0x4e971a87900b931fF39d1Aad67697F49835400b6"
  )) as IRewardTracker;

  const vault = (await hre.ethers.getContractAt(
    "IVault",
    "0x489ee077994B6658eAfA855C308275EAd8097C4A"
  )) as IVault;

  const glp = (await hre.ethers.getContractAt(
    "ERC20",
    "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258"
  )) as ERC20;

  let prevEthGlpPrice = await getEthGlpPrice(
    vault,
    glpManager,
    glp,
    spec.fromBlock
  );
  let prevCummulativeRewards = await rewardTracker.cumulativeRewardPerToken({
    blockTag: spec.fromBlock,
  });

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);

      const cummulativeRewards = await rewardTracker.cumulativeRewardPerToken({
        blockTag: b,
      });

      lastIndex = lastIndex.add(
        cummulativeRewards
          .sub(prevCummulativeRewards)
          .mul(prevEthGlpPrice)
          .div(precision30)
          .div(1000)
      );

      prevCummulativeRewards = cummulativeRewards;
      prevEthGlpPrice = await getEthGlpPrice(vault, glpManager, glp, b);

      yield {
        blockNumber: b,
        timestamp: block.timestamp,
        rate: lastIndex.add(precision27),
        error: null,
        glpData: {
          lastCummulativeReward: prevCummulativeRewards,
          lastEthGlpPrice: prevEthGlpPrice,
        },
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
  const blocksPerDay = 86400 * 3;

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

async function getEthGlpPrice(
  vault: IVault,
  glpManager: IGlpManager,
  glp: ERC20,
  block: number
): Promise<BigNumber> {
  const ethMinPrice = await vault.getMinPrice(
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    {
      blockTag: block,
    }
  );
  const ethMaxPrice = await vault.getMaxPrice(
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    {
      blockTag: block,
    }
  );
  const glpMinAum = await glpManager.getAum(false, {
    blockTag: block,
  });
  const glpMaxAum = await glpManager.getAum(true, {
    blockTag: block,
  });

  const glpSupply = await glp.totalSupply({
    blockTag: block,
  });

  const ethGlpPrice = ethMaxPrice
    .add(ethMinPrice)
    .mul(precision30)
    .div(glpMinAum.add(glpMaxAum).mul(precision18).div(glpSupply));
  return ethGlpPrice;
}
