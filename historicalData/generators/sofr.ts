import { BigNumber, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { IPriceFeed } from "../../typechain";
import { BlockSpec, Datum } from "./common";
import {
  getSofrIndexValueAddress,
  getSofrIndexEffectiveDateAddress,
} from "../../poolConfigs/external-contracts/sofr";

import { DateTime } from "luxon";
// eslint-disable-next-line node/no-extraneous-import
import axios from "axios";
import { getBlockAtTimestamp } from "../../tasks/utils/helpers";

/**
 * Takes a POSIX timestamp and returns a string representation: e.g., 2023-05-14
 * @param timestamp - The POSIX timestamp to process
 */
export const timestampToEffectiveDate = (timestamp: number): string => {
  return DateTime.fromSeconds(timestamp).toISODate();
};

export const effectiveDateToTimestamp = (effectiveDate: string): number => {
  return DateTime.fromISO(`${effectiveDate}T08:00:00.000`, {
    zone: "America/New_York",
  }).toSeconds();
};

export interface SofrDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  rate: "sofr" | "sofr-offchain";
}

type Sofrai = {
  effectiveDate: string;
  type: string;
  average30day: number;
  average90day: number;
  average180day: number;
  index: number;
  revisionIndicator: string;
};

// Generator function for Redstone data
async function* sofrDataGenerator(spec: SofrDataSpec): AsyncGenerator<Datum> {
  const { hre } = spec;

  const sofrIndexValue = (await hre.ethers.getContractAt(
    "IPriceFeed",
    getSofrIndexValueAddress(hre.network.name)
  )) as IPriceFeed;

  const sofrIndexEffectiveDate = (await hre.ethers.getContractAt(
    "IPriceFeed",
    getSofrIndexEffectiveDateAddress(hre.network.name)
  )) as IPriceFeed;

  const priceFeedDecimals = await sofrIndexValue.decimals();
  if (priceFeedDecimals !== 8) {
    throw new Error(
      `Price Feed has ${priceFeedDecimals} decimals. Unsupported precision`
    );
  }

  const scale = BigNumber.from(10).pow(19);

  let lastUpdate = null;
  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const sofrIndex = await sofrIndexValue.latestRoundData({ blockTag: b });
      const sofrIndexTimestamp = await sofrIndexEffectiveDate.latestRoundData({
        blockTag: b,
      });

      if (
        lastUpdate !== null &&
        lastUpdate === sofrIndexTimestamp.answer.toNumber()
      ) {
        continue;
      }

      yield {
        blockNumber: b,
        timestamp: sofrIndexTimestamp.answer.toNumber(),
        rate: sofrIndex.answer.mul(scale),
        error: null,
      };

      lastUpdate = sofrIndexTimestamp.answer.toNumber();
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

// Generator function for Redstone data
async function* sofrOffChainDataGenerator(
  spec: SofrDataSpec
): AsyncGenerator<Datum> {
  const { hre, rate } = spec;

  switch (rate) {
    case "sofr-offchain": {
      break;
    }

    default: {
      throw new Error(`Unrecongized version ${rate} for Redstone`);
    }
  }

  const startTimestamp = (await hre.ethers.provider.getBlock(spec.fromBlock))
    .timestamp;
  const endTimestamp = (await hre.ethers.provider.getBlock(spec.toBlock))
    .timestamp;

  const startEffectiveDate = timestampToEffectiveDate(startTimestamp);
  const endEffectiveDate = timestampToEffectiveDate(endTimestamp);

  const resp = await axios.get(
    `https://markets.newyorkfed.org/api/rates/all/search.json?startDate=${startEffectiveDate}&endDate=${endEffectiveDate}&type=rate`
  );

  const sofraiList = (resp.data.refRates as unknown as Sofrai[])
    .filter((sofrai) => sofrai.type === "SOFRAI")
    .sort(
      (sofrai1, sofrai2) =>
        effectiveDateToTimestamp(sofrai1.effectiveDate) -
        effectiveDateToTimestamp(sofrai2.effectiveDate)
    );

  for (const sofrai of sofraiList) {
    const sofraiTimestamp = effectiveDateToTimestamp(sofrai.effectiveDate);
    yield {
      blockNumber: await getBlockAtTimestamp(hre, sofraiTimestamp),
      timestamp: sofraiTimestamp,
      rate: ethers.utils
        .parseUnits(sofrai.index.toString(), 8)
        .mul(BigNumber.from(10).pow(19)),
      error: null,
    };
  }
}

export async function buildSofrDataGenerator(
  spec: SofrDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  if (spec.rate === "sofr-offchain") {
    return sofrOffChainDataGenerator(spec);
  }

  return sofrDataGenerator(spec);
}
