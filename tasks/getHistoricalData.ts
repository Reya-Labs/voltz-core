import { task, types } from "hardhat/config";
import {
  ILidoOracle,
  IRocketEth,
  IRocketNetworkBalances,
  IStETH,
} from "../typechain";
import { Datum } from "../historicalData/generators/common";
import { buildAaveDataGenerator } from "../historicalData/generators/aave";
import { buildLidoDataGenerator } from "../historicalData/generators/lido";
import { buildRocketDataGenerator } from "../historicalData/generators/rocket";
import { buildCompoundDataGenerator } from "../historicalData/generators/compound";
import { buildGlpDataGenerator } from "../historicalData/generators/glp";
import { getBlockAtTimestamp } from "./utils/helpers";
import { getTokenAddress } from "../poolConfigs/tokens/tokenConfig";
import { getCTokenAddress } from "../poolConfigs/external-contracts/compound";
import {
  getAaveV2LendingPoolAddress,
  getAaveV3LendingPoolAddress,
} from "../poolConfigs/external-contracts/aave";
import {
  getLidoOracleAddress,
  getLidoStETHAddress,
} from "../poolConfigs/external-contracts/lido";
import {
  getRocketETHAddress,
  getRocketNetworkBalancesEthAddress,
} from "../poolConfigs/external-contracts/rocket";

const blocksPerDay = 7200;

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
  arbitrum: ["aaveV3", "glp"],
};

// Example:
//   ``npx hardhat getHistoricalData --network mainnet --from-block 16618430 --platform aaveV3Borrow --token USDC``

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
  .addParam(
    "blockInterval",
    "Script will fetch data every `--block-interval` blocks (between `--from-block` and `--to-block`)",
    blocksPerDay,
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
    const blockInterval = taskArgs.blockInterval;

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
          currentBlock.timestamp - taskArgs.lookbackDays * 24 * 60 * 60
        );

    // Check the block range
    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // Initialize generator
    let generator: AsyncGenerator<Datum> | undefined;

    // Compound / Compound Borrow
    if (platform === "compound" || platform === "compoundBorrow") {
      const cToken = getCTokenAddress(network, tokenName);

      const isEther = tokenName === "ETH";
      const isBorrow = platform === "compoundBorrow";

      generator = await buildCompoundDataGenerator(
        hre,
        cToken,
        undefined,
        isBorrow,
        isEther,
        { fromBlock, toBlock, blockInterval: blockInterval }
      );
    }

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
      const lendingPoolAddress =
        platform === "aaveV3" || platform === "aaveV3Borrow"
          ? getAaveV3LendingPoolAddress(network)
          : getAaveV2LendingPoolAddress(network);

      const borrow = platform === "aaveV3Borrow" || platform === "aaveV2Borrow";

      // Instantiate generator
      generator = await buildAaveDataGenerator({
        hre,
        lendingPoolAddress,
        underlyingAddress: tokenAddress,
        borrow,
        fromBlock: fromBlock,
        blockInterval: blockInterval,
        toBlock: toBlock,
      });
    }

    if (platform === "lido") {
      // check if token is ETH
      if (!(tokenName === "ETH")) {
        throw new Error(`Only ETH token needs to be passed for Lido.`);
      }

      // Fetch Lido Oracle address
      const lidoOracle = (await hre.ethers.getContractAt(
        "ILidoOracle",
        getLidoOracleAddress(network)
      )) as ILidoOracle;

      // Fetch stETH address
      const stEth = (await hre.ethers.getContractAt(
        "IStETH",
        getLidoStETHAddress(network)
      )) as IStETH;

      generator = await buildLidoDataGenerator(hre, undefined, {
        stEth,
        lidoOracle,
        fromBlock,
        toBlock,
        blockInterval: blockInterval,
      });
    }

    if (platform === "rocket") {
      // check if token is ETH
      if (!(tokenName === "ETH")) {
        throw new Error(`Only ETH token needs to be passed for Rocket.`);
      }

      const rocketNetworkBalances = (await hre.ethers.getContractAt(
        "IRocketNetworkBalances",
        getRocketNetworkBalancesEthAddress(network)
      )) as IRocketNetworkBalances;

      const rocketEth = (await hre.ethers.getContractAt(
        "IRocketEth",
        getRocketETHAddress(network)
      )) as IRocketEth;

      generator = await buildRocketDataGenerator(hre, undefined, {
        rocketNetworkBalances,
        rocketEth,
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
        throw new Error(`Only ETH token needs to be passed for Rocket.`);
      }

      generator = await buildGlpDataGenerator(hre, taskArgs.lookbackDays);
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
