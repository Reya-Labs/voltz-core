import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { toBn } from "../../test/helpers/toBn";
import { IRocketEth, IRocketNetworkBalances } from "../../typechain";
import { BlockSpec, Datum, blocksPerDay } from "./common";

export interface RocketDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  rocketNetworkBalances: IRocketNetworkBalances;
  rocketEth: IRocketEth;
}

// Generator function for Aave data
async function* rocketDataGenerator(
  spec: RocketDataSpec
): AsyncGenerator<Datum> {
  const { hre, rocketNetworkBalances, rocketEth } = spec;
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
  hre: HardhatRuntimeEnvironment,
  lookbackDays?: number,
  overrides?: Partial<RocketDataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");

  const defaults = {
    fromBlock: lookbackDays
      ? currentBlock.number - blocksPerDay * lookbackDays
      : 13326304, // 13326304 = ~rocket deploy on mainnet
    blockInterval: blocksPerDay,
    toBlock: currentBlock.number,
    hre,
    rocketEth: (await hre.ethers.getContractAt(
      "IRocketEth",
      "0xae78736Cd615f374D3085123A210448E74Fc6393" // mainnet rocket eth address
    )) as IRocketEth,
    rocketNetworkBalances: (await hre.ethers.getContractAt(
      "IRocketNetworkBalances",
      "0x138313f102ce9a0662f826fca977e3ab4d6e5539" // mainnet RocketNetworkBalances address
    )) as IRocketNetworkBalances,
  };

  return rocketDataGenerator({
    ...defaults,
    ...overrides,
  });
}
