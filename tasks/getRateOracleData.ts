import { task, types } from "hardhat/config";
import { BaseRateOracle } from "../typechain";
import { getRateOracleByNameOrAddress } from "./utils/helpers";

const blocksPerDay = 7200;

const formatNumber = (value: number): string => {
  return value.toFixed(4);
};

// Description:
//   This task fetches the APYs and liquidity indices of a rate oracle and outputs the results into .csv file

// Example:
//   ``npx hardhat getRateOracleData --network mainnet --from-block 16593430 --block-interval 7200 --lookback-window 86400 --rate-oracle 0xA6BA323693f9e9B591F79fbDb947c7330ca2d7ab``

// Estimated execution time: 1s per 1 data point

task(
  "getRateOracleData",
  "Gets historical liquidity index and APY values from an existing rate oracle. Some values may be duplicated."
)
  .addParam(
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
  .addParam(
    "lookbackWindow",
    "The lookback window to use, in seconds, when querying data from a RateOracle",
    60 * 60 * 24 * 28, // 28 days
    types.int
  )
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .addParam(
    "rateOracle",
    "Name or address of Rate Oracle to query",
    undefined,
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const start = Date.now();
    const fs = require("fs");

    // Fetch rate oracle
    const rateOracle = (await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    )) as BaseRateOracle;

    // Fetch current block
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;

    // Compute starting and ending blocks
    let toBlock = currentBlockNumber;
    const fromBlock = taskArgs.fromBlock;

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlockNumber, taskArgs.toBlock);
    }

    // Check the block range
    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    const exportFolder = `historicalData/rateOracleApy`;
    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    // Initialize the export file
    const exportFile = `${exportFolder}/${taskArgs.rateOracle}.csv`;
    const header = `block,timestamp,datetime,liquidityIndex,${taskArgs.lookbackWindow}-second APY`;

    fs.appendFileSync(exportFile, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);

      try {
        // Get the last updated rate
        const [liquidityIndexTimestamp, liquidityIndex] =
          await rateOracle.getLastUpdatedRate({
            blockTag: b,
          });

        // Get APY over the look-back window
        const apyWad = await rateOracle.getApyFromTo(
          block.timestamp - taskArgs.lookbackWindow,
          block.timestamp,
          {
            blockTag: b,
          }
        );

        // Export the data to .csv file
        const apy = Number(hre.ethers.utils.formatUnits(apyWad, 16));

        const output = `${b},${liquidityIndexTimestamp},${new Date(
          liquidityIndexTimestamp * 1000
        ).toISOString()},${liquidityIndex.toString()},${formatNumber(apy)}%`;

        fs.appendFileSync(exportFile, output + "\n");
        console.log(output);
      } catch (error) {
        console.warn(`Couldn't fetch at block ${b}`);
      }
    }

    const end = Date.now();
    console.log(`Finished in ${(end - start) / 1000} seconds.`);
  });

module.exports = {};
