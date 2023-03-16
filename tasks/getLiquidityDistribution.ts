import { task } from "hardhat/config";

import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../scripts/getProtocolSubgraphURL";
import { MarginEngine } from "../typechain";
import { getPositionInfo } from "./utils/helpers";

const formatNumber = (value: number): string => {
  return value.toFixed(4);
};

// Description:
//   This task fetches all liquidity by address and outputs the result into .csv file
//
// Example:
//   ``npx hardhat getLiquidityDistribution --network mainnet aUSDC_v11 stETH_v2``
//
// Estimated execution time: 30s per 100 positions

task("getLiquidityDistribution", "Retrieves the liquidity distribution")
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .setAction(async (taskArgs, hre) => {
    const start = Date.now();
    const fs = require("fs");

    const exportFolder = `tasks/output/liquidity_distributions`;
    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;
    const poolDetails = getNetworkPools(hre.network.name);

    // Check if queried pools are in the config
    for (const pool of poolNames) {
      if (!Object.keys(poolDetails).includes(pool)) {
        throw new Error(`Pool ${pool} is not present in the pools.`);
      }
    }

    // Fetch current time
    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    // Retrieve all LP positions from subgraph
    const positions = (
      await getPositions(
        getProtocolSubgraphURL(hre.network.name),
        currentTimeInMS,
        {
          ammIDs: poolNames.map((pool) => poolDetails[pool].vamm),
        }
      )
    ).filter((position) => position.positionType === 3);

    console.log("Number of LP positions to process:", positions.length);

    for (const poolName of poolNames) {
      console.log(`Processing for ${poolName}...`);
      const pool = poolDetails[poolName as keyof typeof poolDetails];

      // Fetch margin engine
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        pool.marginEngine
      )) as MarginEngine;

      // Filter the positions belonging to the current pool
      const mePositions = positions.filter(
        (p) =>
          p.amm.marginEngineId.toLowerCase() === pool.marginEngine.toLowerCase()
      );

      // Initialize a map from address to liquidity
      const liquidity = new Map<string, number>();
      for (const position of mePositions) {
        // Fetch position information and update the liquidity of the corresponding address
        const positionInfo = await getPositionInfo(
          marginEngine,
          position,
          pool.decimals
        );

        if (positionInfo.liquidity > 0) {
          liquidity.set(
            position.owner,
            (liquidity.get(position.owner) || 0) + positionInfo.liquidity
          );
        }
      }

      // Turn map into array and sort desc. by liquidity
      const entries: [string, number][] = [];
      for (const e of liquidity.entries()) {
        entries.push(e);
      }

      entries.sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((acc, curr) => acc + curr[1], 0);

      // Export the data to .csv file
      const exportFile = `${exportFolder}/${hre.network.name}-${poolName}.csv`;
      const header = "address,liquidity,percentage";

      fs.writeFileSync(exportFile, header + "\n", () => {});

      if (total === 0) {
        console.warn(`Pool ${poolName} does not have any liquidity.`);
        continue;
      }

      entries.forEach(([owner, liq]) => {
        fs.appendFileSync(
          exportFile,
          `${owner},${formatNumber(liq)},${formatNumber(
            (liq / total) * 100
          )}%\n`
        );
      });
      console.log(`Finished for ${poolName}.`);
      console.log();
    }

    const end = Date.now();
    console.log(`Finished in ${(end - start) / 1000} seconds.`);
  });

module.exports = {};
