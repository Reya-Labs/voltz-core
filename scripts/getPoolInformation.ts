import * as dotenv from "dotenv";

import { ethers } from "ethers";
import {
  BaseRateOracle__factory,
  MarginEngine__factory,
  VAMM__factory,
} from "../typechain";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";
import { getProtocolSubgraphURL } from "./getProtocolSubgraphURL";
import { getPositions } from "@voltz-protocol/subgraph-data";
import {
  ONE_DAY_IN_SECONDS,
  ONE_YEAR_IN_SECONDS,
} from "../tasks/utils/constants";

dotenv.config();

const formatNumber = (value: number, decimals = 4): string => {
  return value.toFixed(decimals);
};

const networks = ["mainnet", "arbitrum"];

const checkPoolInformation = async () => {
  const fs = require("fs");

  const exportFolder = `./scripts/output`;
  // Check if folder exists, or create one if it doesn't
  if (!fs.existsSync(exportFolder)) {
    fs.mkdirSync(exportFolder, { recursive: true });
  }

  const exportFile = `${exportFolder}/pool-data.csv`;
  const header =
    "network,pool_name,duration,end_date,notional_traded,time_weighted_notional_traded,fee,liquidity_provided,margin_in,notional_traded_percentage_in_FT,vamm_address,pool_id";

  fs.writeFileSync(exportFile, header + "\n", () => {});
  console.log(header);

  for (const network of networks) {
    console.log(`Kicking off scraping for ${network}...`);

    // Build the JSON RPC provider for each network
    const providerKey = `${network.toUpperCase()}_URL`;
    const provider = new ethers.providers.JsonRpcProvider(
      process.env[providerKey] || ""
    );

    // Retrieve pool details for each network
    const pools = getNetworkPools(network);

    // Fetch current time
    const currentTimeInMS =
      (await provider.getBlock("latest")).timestamp * 1000;

    for (const poolName of Object.keys(pools)) {
      console.log(`Scraping for ${poolName}`);
      const poolDetails = pools[poolName];

      const positions = await getPositions(
        getProtocolSubgraphURL(network),
        currentTimeInMS,
        {
          ammIDs: [poolDetails.vamm],
        },
        true
      );

      // Fetch the margin engine contract
      const marginEngine = MarginEngine__factory.connect(
        poolDetails.marginEngine,
        provider
      );

      // Fetch the vamm contract
      const vamm = VAMM__factory.connect(poolDetails.vamm, provider);

      // Retrieve start and end timestamp
      const termStartWad = await marginEngine.termStartTimestampWad();
      const timeStart = Number(ethers.utils.formatUnits(termStartWad, 18));
      const termEndWad = await marginEngine.termEndTimestampWad();
      const timeEnd = Number(ethers.utils.formatUnits(termEndWad, 18));

      const durationInDays = Math.round(
        (timeEnd - timeStart) / ONE_DAY_IN_SECONDS
      );

      const endDate = new Date(timeEnd * 1000)
        .toDateString()
        .split(" ")
        .slice(1)
        .join(" ");

      if (timeEnd * 1000 > currentTimeInMS) {
        continue;
      }

      const fee = Number(ethers.utils.formatUnits(await vamm.feeWad(), 18));

      const notionals = [0, 0];
      const twNotionals = [0, 0];
      let liquidityIn = 0;
      let marginIn = 0;

      positions.forEach((pos) => {
        pos.swaps.forEach(({ variableTokenDelta, creationTimestampInMS }) => {
          const timeFactor =
            (timeEnd - creationTimestampInMS / 1000) / ONE_YEAR_IN_SECONDS;
          if (variableTokenDelta < 0) {
            notionals[0] -= variableTokenDelta;
            twNotionals[0] -= variableTokenDelta * timeFactor;
          } else {
            notionals[1] += variableTokenDelta;
            twNotionals[1] += variableTokenDelta * timeFactor;
          }
        });

        pos.mints.forEach(({ liquidity }) => {
          liquidityIn += liquidity;
        });

        pos.marginUpdates.forEach(({ marginDelta }) => {
          if (marginDelta > 0) {
            marginIn += marginDelta;
          }
        });
      });

      // fetch market name
      const rateOracleAddress = await marginEngine.rateOracle();
      const rateOracle = BaseRateOracle__factory.connect(
        rateOracleAddress,
        provider
      );

      const rateOracleId =
        await rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

      let market = poolName.split("_")[poolName.split("_").length - 2];
      if (rateOracleId === 5 || rateOracleId === 6) {
        market += " borrow";
      }

      if (rateOracleId === 7) {
        market += " v3";
      }

      const output = `${network},${market},${durationInDays} days,${endDate},${Math.round(
        notionals[0] + notionals[1]
      )},${Math.round(twNotionals[0] + twNotionals[1])},${formatNumber(
        fee * 100,
        1
      )}%,${Math.round(liquidityIn)},${Math.round(marginIn)},${formatNumber(
        (notionals[0] / (notionals[0] + notionals[1])) * 100,
        2
      )}%,${vamm.address},${poolName}`;

      console.log(output);
      fs.appendFileSync(exportFile, output + "\n");
    }
  }
};

checkPoolInformation();
