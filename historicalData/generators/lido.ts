import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getLidoOracleAddress,
  getLidoStETHAddress,
} from "../../poolConfigs/external-contracts/lido";
import { toBn } from "../../test/helpers/toBn";
import { ILidoOracle, IStETH } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface LidoDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
}

// Generator function for Lido data
async function* lidoDataGenerator(spec: LidoDataSpec): AsyncGenerator<Datum> {
  const { hre } = spec;

  // Fetch Lido Oracle address
  const lidoOracle = (await hre.ethers.getContractAt(
    "ILidoOracle",
    getLidoOracleAddress(hre.network.name)
  )) as ILidoOracle;

  // Fetch stETH address
  const stEth = (await hre.ethers.getContractAt(
    "IStETH",
    getLidoStETHAddress(hre.network.name)
  )) as IStETH;

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    let previousCompletedTimestamp: BigNumber | undefined;
    try {
      const rate = await stEth.getPooledEthByShares(toBn(1, 27), {
        blockTag: b,
      });

      const epoch = await lidoOracle.getLastCompletedEpochId({
        blockTag: b,
      });

      const beaconSpec = await lidoOracle.getBeaconSpec({
        blockTag: b,
      });

      const lastCompletedTime = beaconSpec.genesisTime.add(
        epoch.mul(beaconSpec.slotsPerEpoch).mul(beaconSpec.secondsPerSlot)
      );

      if (
        previousCompletedTimestamp &&
        previousCompletedTimestamp === lastCompletedTime
      ) {
        // We already have this data point. Skip it.
        continue;
      } else {
        yield {
          blockNumber: b,
          timestamp: lastCompletedTime.toNumber(),
          rate,
          error: null,
        };
        previousCompletedTimestamp = lastCompletedTime;
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

export async function buildLidoDataGenerator(
  spec: LidoDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  return lidoDataGenerator(spec);
}
