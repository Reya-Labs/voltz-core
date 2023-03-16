import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { IMarginEngine } from "../typechain";
import { getNetworkPools } from "../pool-addresses/getPools";

// eslint-disable-next-line no-unused-vars
enum FETCH_STATUS {
  // eslint-disable-next-line no-unused-vars
  FAILURE,
  // eslint-disable-next-line no-unused-vars
  SUCCESS,
}

task("getHistoricalApy", "Get historical APY of some given margine engine")
  .addOptionalParam(
    "fromBlock",
    "Get data from this past block number (up to some larger block number defined by `toBlock`)",
    undefined,
    types.int
  )
  .addParam(
    "blockInterval",
    "Script will fetch data every `blockInterval` blocks (between `fromBlock` and `toBlock`)",
    7200,
    types.int
  )
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .addParam("pool", "Queried pool")
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    const poolAddresses = getNetworkPools(hre.network.name);
    const pool = poolAddresses[taskArgs.pool as keyof typeof poolAddresses];

    if (!pool) {
      throw new Error(`Unrecognized pool name ${hre.network.name}`);
    }

    const deploymentBlockNumber = pool.deploymentBlock;

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      pool.marginEngine
    )) as IMarginEngine;

    // Set the block range of the query
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    let fromBlock = deploymentBlockNumber;
    let toBlock = currentBlockNumber;

    if (taskArgs.fromBlock) {
      fromBlock = Math.max(deploymentBlockNumber, taskArgs.fromBlock);
    }

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlockNumber, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // Create the output file
    const EXPORT_FOLDER = `historicalData/historicalApy`;

    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    const file = `${EXPORT_FOLDER}/${marginEngine.address}.csv`;

    const header = "block,timestamp,apy";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    // Initialize data
    const blocks: number[] = [];
    const timestamps: number[] = [];
    const apys: number[] = [];

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);
      let fetch: FETCH_STATUS = FETCH_STATUS.FAILURE;

      if (b >= deploymentBlockNumber) {
        try {
          const historicalApy = await marginEngine.getHistoricalApyReadOnly({
            blockTag: b,
          });
          blocks.push(b);
          timestamps.push(block.timestamp);
          apys.push(
            historicalApy.div(BigNumber.from(10).pow(9)).toNumber() / 1e9
          );
          fetch = FETCH_STATUS.SUCCESS;
        } catch (error) {}
      }

      switch (fetch) {
        case FETCH_STATUS.SUCCESS: {
          const lastBlock = blocks[blocks.length - 1];
          const lastTimestamp = timestamps[timestamps.length - 1];
          const lastApy = apys[apys.length - 1];

          fs.appendFileSync(file, `${lastBlock},${lastTimestamp},${lastApy}\n`);
          console.log(
            `${lastBlock},${lastTimestamp},${new Date(
              lastTimestamp * 1000
            ).toISOString()},${lastApy}`
          );
          break;
        }
        case FETCH_STATUS.FAILURE: {
          console.log(`Couldn't fetch at block ${b}`);
          break;
        }
      }
    }
  });

module.exports = {};
