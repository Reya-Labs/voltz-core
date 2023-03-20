import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getRocketETHAddress,
  getRocketNetworkBalancesEthAddress,
} from "../../poolConfigs/external-contracts/rocket";
import { toBn } from "../../test/helpers/toBn";
import { IRocketEth, IRocketNetworkBalances } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface RocketDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
}

// Generator function for Aave data
async function* rocketDataGenerator(
  spec: RocketDataSpec
): AsyncGenerator<Datum> {
  const { hre } = spec;

  const rocketNetworkBalances = (await hre.ethers.getContractAt(
    "IRocketNetworkBalances",
    getRocketNetworkBalancesEthAddress(hre.network.name)
  )) as IRocketNetworkBalances;

  const rocketEth = (await hre.ethers.getContractAt(
    "IRocketEth",
    getRocketETHAddress(hre.network.name)
  )) as IRocketEth;

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    let previousBlockNumber: number | undefined;
    try {
      const rate = await rocketEth.getEthValue(toBn(1, 27), {
        blockTag: b,
      });

      const balancesBlockNumber = (
        await rocketNetworkBalances.getBalancesBlock({
          blockTag: b,
        })
      ).toNumber();

      if (previousBlockNumber && previousBlockNumber === balancesBlockNumber) {
        // We already have this data point. Skip it.
        continue;
      } else {
        const balancesBlock = await hre.ethers.provider.getBlock(
          balancesBlockNumber
        );
        yield {
          blockNumber: b,
          timestamp: balancesBlock.timestamp,
          rate,
          error: null,
        };
        previousBlockNumber = balancesBlockNumber;
      }
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

export async function buildRocketDataGenerator(
  spec: RocketDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  return rocketDataGenerator(spec);
}
