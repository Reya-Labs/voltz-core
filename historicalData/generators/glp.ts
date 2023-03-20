import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getGlpManagerAddress,
  getGlpRewardTrackerAddress,
  getGlpTokenAddress,
  getGlpVaultAddress,
} from "../../poolConfigs/external-contracts/glp";
import { getTokenAddress } from "../../poolConfigs/tokens/tokenConfig";
import { ERC20, IGlpManager, IRewardTracker, IVault } from "../../typechain";
import { BlockSpec, Datum } from "./common";

const precision27 = BigNumber.from(10).pow(27);
const precision30 = BigNumber.from(10).pow(30);
const precision18 = BigNumber.from(10).pow(18);

export interface GlpDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
}

// Generator function for GLP data
async function* glpDataGenerator(spec: GlpDataSpec): AsyncGenerator<Datum> {
  const { hre } = spec;

  // Fetch GLP manager contract
  const glpManager = (await hre.ethers.getContractAt(
    "IGlpManager",
    getGlpManagerAddress(hre.network.name)
  )) as IGlpManager;

  // Fetch reward tracker contract
  const rewardTracker = (await hre.ethers.getContractAt(
    "IRewardTracker",
    getGlpRewardTrackerAddress(hre.network.name)
  )) as IRewardTracker;

  // Fetch vault contract
  const vault = (await hre.ethers.getContractAt(
    "IVault",
    getGlpVaultAddress(hre.network.name)
  )) as IVault;

  // Fetch GLP token contract
  const glp = (await hre.ethers.getContractAt(
    "ERC20",
    getGlpTokenAddress(hre.network.name)
  )) as ERC20;

  // Fetch WETH token address
  const wethAddress = getTokenAddress(hre.network.name, "WETH");

  // Initialise data
  let lastIndex: BigNumber = BigNumber.from(0);

  let prevEthGlpPrice = await getEthGlpPrice(
    vault,
    glpManager,
    glp,
    wethAddress,
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
      prevEthGlpPrice = await getEthGlpPrice(
        vault,
        glpManager,
        glp,
        wethAddress,
        b
      );

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
  spec: GlpDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  return glpDataGenerator(spec);
}

async function getEthGlpPrice(
  vault: IVault,
  glpManager: IGlpManager,
  glp: ERC20,
  wethAddress: string,
  block: number
): Promise<BigNumber> {
  const ethMinPrice = await vault.getMinPrice(wethAddress, {
    blockTag: block,
  });

  const ethMaxPrice = await vault.getMinPrice(wethAddress, {
    blockTag: block,
  });

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
