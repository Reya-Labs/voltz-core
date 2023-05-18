import { task, types } from "hardhat/config";
import { Datum } from "../historicalData/generators/common";
import { buildAaveDataGenerator } from "../historicalData/generators/aave";
import { buildLidoDataGenerator } from "../historicalData/generators/lido";
import { buildRocketDataGenerator } from "../historicalData/generators/rocket";
import { buildCompoundDataGenerator } from "../historicalData/generators/compound";
import { buildGlpDataGenerator } from "../historicalData/generators/glp";
import { getBlockAtTimestamp, getEstimatedBlocksPerDay } from "./utils/helpers";
import { getTokenAddress } from "../poolConfigs/tokens/tokenConfig";
import { getCTokenAddress } from "../poolConfigs/external-contracts/compound";
import { ONE_DAY_IN_SECONDS } from "./utils/constants";
import { buildRedstoneDataGenerator } from "../historicalData/generators/redstone";

const supportedPlatforms: { [key: string]: string[] } = {
  mainnet: [
    "aaveV2",
    "aaveV2Borrow",
    "aaveV3",
    "aaveV3Borrow",
    "compound",
    "compoundBorrow",
    "lido",
    "rocket",
  ],
  arbitrum: ["aaveV3", "aaveV3Borrow", "glp"],
  avalancheFuji: ["sofr", "sofr-offchain"],
};

// Description:
//   This task fetches rates from external platforms such as Aave, Compound, Lido, Rocket or GLP.
//   Check the support platforms above for more granularity.
//
//   Params:
//     - toBlock: block where the scraping ends (default: current block)
//
//     - fromBlock: block where the scraping starts
//     - lookbackDays: the scraping is performed this number of days before toBlock
//     Only one of this parameters should be passed (fromBlock has higher priority)
//
//     - blockInterval: the frequency of scraping in blocks (default: est. number of blocks per day)
//
//     - platform: the platform where the scraping happens
// Example:
//   ``npx hardhat getHistoricalData --network mainnet --from-block 16618430 --platform aaveV3Borrow --token USDC``
//   ``npx hardhat getHistoricalData --network arbitrum --lookback-days 30 --platform glp --token ETH``

task("getHistoricalData", "Retrieves the historical rates")
  .addOptionalParam(
    "fromBlock",
    "Get data from this past block number (up to some larger block number defined by `toBlock`). Supersedes --lookback-days",
    undefined,
    types.int
  )
  .addOptionalParam(
    "lookbackDays",
    "Look back this many days from `--to-block`. Ignored if `--from-block` is specified",
    undefined,
    types.int
  )
  .addOptionalParam(
    "blockInterval",
    "Script will fetch data every `--block-interval` blocks (between `--from-block` and `--to-block`)",
    undefined,
    types.int
  )
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .addParam(
    "platform",
    "Get rates for supported platforms (e.g. aave, aaveBorrow, compound)"
  )
  .addParam("token", "Get rates for the underlying token")
  .setAction(async (taskArgs, hre) => {
    const start = Date.now();
    const fs = require("fs");

    // parse inputs
    const platform = taskArgs.platform;
    const network = hre.network.name;
    const tokenName = taskArgs.token;
    const blockInterval =
      taskArgs.blockInterval || (await getEstimatedBlocksPerDay(hre));

    // Check if platform is supported
    if (!Object.keys(supportedPlatforms).includes(network)) {
      throw new Error(`Network ${network} is not supported.`);
    }

    if (!supportedPlatforms[network].includes(platform)) {
      throw new Error(
        `Platform ${platform} is not supported on ${network}. Check supported platforms or add support for it!`
      );
    }

    // Check if lookback window is passed
    if (!taskArgs.fromBlock && !taskArgs.lookbackDays) {
      throw new Error(
        `One of --from-block and --lookback-days must be specified`
      );
    }

    // Fetch current block
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;

    // Compute starting and ending blocks
    let toBlock = currentBlockNumber;

    if (taskArgs.toBlock) {
      toBlock = Math.min(toBlock, taskArgs.toBlock);
    }

    const fromBlock: number = taskArgs.fromBlock
      ? taskArgs.fromBlock
      : await getBlockAtTimestamp(
          hre,
          currentBlock.timestamp - taskArgs.lookbackDays * ONE_DAY_IN_SECONDS
        );

    // Check the block range
    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // Initialize generator
    let generator: AsyncGenerator<Datum> | undefined;

    //  Aave v3
    if (
      platform === "aaveV3" ||
      platform === "aaveV3Borrow" ||
      platform === "aaveV2" ||
      platform === "aaveV2Borrow"
    ) {
      // Fetch token address
      const tokenAddress = getTokenAddress(network, tokenName);

      // Fetch aave v3 lending pool
      const version =
        platform === "aaveV3" || platform === "aaveV3Borrow" ? 3 : 2;

      const borrow = platform === "aaveV3Borrow" || platform === "aaveV2Borrow";

      // Instantiate generator
      generator = await buildAaveDataGenerator({
        hre,
        version,
        underlyingAddress: tokenAddress,
        borrow,
        fromBlock,
        blockInterval,
        toBlock,
      });
    }

    // Compound / Compound Borrow
    if (platform === "compound" || platform === "compoundBorrow") {
      const cTokenAddress = getCTokenAddress(network, tokenName);

      const isEther = tokenName === "ETH";
      const borrow = platform === "compoundBorrow";

      generator = await buildCompoundDataGenerator({
        fromBlock,
        toBlock,
        blockInterval,
        hre,
        cTokenAddress,
        isEther,
        borrow,
      });
    }

    if (platform === "lido") {
      // check if token is ETH
      if (!(tokenName === "ETH")) {
        throw new Error(`Only ETH token needs to be passed for Lido.`);
      }

      generator = await buildLidoDataGenerator({
        hre,
        fromBlock,
        toBlock,
        blockInterval,
      });
    }

    if (platform === "rocket") {
      // check if token is ETH
      if (!(tokenName === "ETH")) {
        throw new Error(`Only ETH token needs to be passed for Rocket.`);
      }
      generator = await buildRocketDataGenerator({
        hre,
        fromBlock,
        toBlock,
        blockInterval,
      });
    }

    // glp
    if (platform === "glp") {
      if (!(hre.network.name === "arbitrum")) {
        throw new Error(`Network ${network} unsupported for GLP.`);
      }

      // check if token is ETH
      if (!(tokenName === "ETH")) {
        throw new Error(`Only ETH token needs to be passed for GLP.`);
      }

      generator = await buildGlpDataGenerator({
        hre,
        fromBlock,
        toBlock,
        blockInterval,
      });
    }

    // sofr
    if (platform === "sofr" || platform === "sofr-offchain") {
      if (!(hre.network.name === "avalancheFuji")) {
        throw new Error(`Network ${network} unsupported for SOFR.`);
      }

      // check if token is ETH
      if (!(tokenName === "USDC")) {
        throw new Error(`Only USDC token needs to be passed for Redstone.`);
      }

      generator = await buildRedstoneDataGenerator({
        hre,
        fromBlock,
        toBlock,
        blockInterval,
        rate: platform,
      });
    }

    const exportFolder = `historicalData/rates`;
    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    // Initialize the export file
    const exportFile = `${exportFolder}/${network}-${platform}-${tokenName}.csv`;
    const header = `date,timestamp,liquidityIndex`;

    fs.appendFileSync(exportFile, header + "\n");
    console.log(header);

    if (generator) {
      // use the platform-specific generator initialised above to get the data points
      for await (const { blockNumber, timestamp, rate, error } of generator) {
        if (error) {
          console.log(`Error retrieving data for block ${blockNumber}`);
        } else {
          const output = `${new Date(
            timestamp * 1000
          ).toISOString()},${timestamp},${rate.toString()}`;

          fs.appendFileSync(exportFile, output + "\n");
          console.log(output);
        }
      }
    }

    const end = Date.now();
    console.log(`Finished in ${(end - start) / 1000} seconds.`);
  });

module.exports = {};
