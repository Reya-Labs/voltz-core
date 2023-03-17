import { task, types } from "hardhat/config";
import { IMarginEngine } from "../typechain";
import { getPool } from "../poolConfigs/pool-addresses/pools";

const blocksPerDay = 7200;

const formatNumber = (value: number): string => {
  return value.toFixed(4);
};

// Description:
//   This task fetches the historical APYs of a given margin engine and outputs the results into .csv file

// Example:
//   ``npx hardhat getHistoricalApy --network arbitrum --block-interval 432000 --pool glpETH_v1``

// Estimated execution time: 66s per 100 data points

task("getHistoricalApy", "Get historical APY of some given margine engine")
  .addParam("pool", "Pool name")
  .addOptionalParam(
    "fromBlock",
    "Get data from this past block number (up to some larger block number defined by `toBlock`)",
    undefined,
    types.int
  )
  .addParam(
    "blockInterval",
    "Script will fetch data every `blockInterval` blocks (between `fromBlock` and `toBlock`)",
    blocksPerDay,
    types.int
  )
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .setAction(async (taskArgs, hre) => {
    const start = Date.now();
    const fs = require("fs");

    const pool = getPool(hre.network.name, taskArgs.pool);

    // Fetch margin engine
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      pool.marginEngine
    )) as IMarginEngine;

    // Retrieve term end of the pool
    const termEndWad = await marginEngine.termEndTimestampWad();
    const timeEnd = Number(hre.ethers.utils.formatUnits(termEndWad, 18));

    // Compute starting and ending blocks
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    let fromBlock = pool.deploymentBlock;
    let toBlock = currentBlock.number;

    if (taskArgs.fromBlock) {
      fromBlock = Math.max(pool.deploymentBlock, taskArgs.fromBlock);
    }

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlock.number, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // Create the output file
    const exportFolder = `historicalData/historicalApy`;

    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    const file = `${exportFolder}/${hre.network.name}-${taskArgs.pool}.csv`;

    const header = "block,timestamp,date,apy";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);

      try {
        const historicalApyWad = await marginEngine.getHistoricalApyReadOnly({
          blockTag: b,
        });

        const historicalApy = Number(
          hre.ethers.utils.formatUnits(historicalApyWad, 18)
        );

        const output = `${b},${block.timestamp},${new Date(
          block.timestamp * 1000
        ).toISOString()},${formatNumber(historicalApy * 100)}%`;

        fs.appendFileSync(file, output + "\n");
        console.log(output);
      } catch (error) {
        console.warn(`Couldn't fetch at block ${b}`);
      }

      if (block.timestamp >= timeEnd) {
        console.warn(
          `Stopping here. The block timestamp is already after term end.`
        );
        break;
      }
    }

    const end = Date.now();
    console.log(`Finished in ${(end - start) / 1000} seconds.`);
  });

module.exports = {};
