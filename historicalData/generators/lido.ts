import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { toBn } from "../../test/helpers/toBn";
import { ILidoOracle, IStETH } from "../../typechain";
import { BlockSpec, Datum, blocksPerDay } from "./common";

export interface LidoDataSpec extends BlockSpec {
  stEth: IStETH;
  lidoOracle: ILidoOracle;
}

// Generator function for Aave data
async function* lidoDataGenerator(spec: LidoDataSpec): AsyncGenerator<Datum> {
  const { stEth, lidoOracle } = spec;
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
  hre: HardhatRuntimeEnvironment,
  lookbackDays?: number,
  overrides?: Partial<LidoDataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  const defaults = {
    fromBlock: lookbackDays
      ? currentBlock.number - blocksPerDay * lookbackDays
      : 11593216, // 11593216 = ~stEth deploy on mainnet
    blockInterval: blocksPerDay,
    toBlock: currentBlock.number,
    stEth: (await hre.ethers.getContractAt(
      "IStETH",
      "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" // mainnet stEth address
    )) as IStETH,
    lidoOracle: (await hre.ethers.getContractAt(
      "ILidoOracle",
      "0x442af784a788a5bd6f42a01ebe9f287a871243fb" // mainnet lido oracle address
    )) as ILidoOracle,
  };

  return lidoDataGenerator({
    ...defaults,
    ...overrides,
  });
}
