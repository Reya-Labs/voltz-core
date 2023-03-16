import { task, types } from "hardhat/config";
import {
  ICToken,
  ILidoOracle,
  IPool,
  IRocketEth,
  IRocketNetworkBalances,
  IStETH,
} from "../typechain";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { Datum } from "../historicalData/generators/common";
import {
  buildAaveDataGenerator,
  buildAaveV3DataGenerator,
} from "../historicalData/generators/aave";
import { buildLidoDataGenerator } from "../historicalData/generators/lido";
import { buildRocketDataGenerator } from "../historicalData/generators/rocket";
import { buildCompoundDataGenerator } from "../historicalData/generators/compound";
import { buildGlpDataGenerator } from "../historicalData/generators/glp";

// lido
const lidoStEthMainnetAddress = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const lidoOracleAddress = "0x442af784a788a5bd6f42a01ebe9f287a871243fb";

// rocket
const rocketEthMainnetAddress = "0xae78736Cd615f374D3085123A210448E74Fc6393";
const RocketNetworkBalancesEthMainnet =
  "0x138313f102ce9a0662f826fca977e3ab4d6e5539";

// compound
const cTokenAddresses = {
  cDAI: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
  cUSDC: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  cWBTC: "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
  cWBTC2: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
  cUSDT: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  cTUSD: "0x12392f67bdf24fae0af363c24ac620a2f67dad86",
  cETH: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
};

// aave
const aTokenUnderlyingAddresses = {
  aDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  aUSDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  aWBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  aUSDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  aTUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
  aWETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};

// aave arbitrum
const aTokenUnderlyingAddressesArbitrum = {
  aUSDC: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
};

const blocksPerDay = 7200;
const blocksPerDayArbitrum = 60 * 60 * 24 * 3; // 3 blocks per second

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
  .addFlag("lido", "Get rates data from Lido for their ETH staking returns")
  .addFlag(
    "rocket",
    "Get rates data from RocketPool for their ETH staking returns"
  )
  .addFlag("compound", "Get rates data from Compound")
  .addFlag("aave", "Get rates data from Aave")
  .addFlag("aaveV3", "Get rates data from Aave V3")
  .addFlag("glp", "Get rates data from Glp")
  .addFlag(
    "borrow",
    "Choose to query borrow rate, ommit to query lending rates"
  )
  .addOptionalParam(
    "token",
    "Get rates for the underlying token",
    "ETH",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    let platformCount = 0;
    taskArgs.aaveV3 && platformCount++;
    taskArgs.aave && platformCount++;
    taskArgs.compound && platformCount++;
    taskArgs.rocket && platformCount++;
    taskArgs.lido && platformCount++;
    taskArgs.glp && platformCount++;

    if (!taskArgs.fromBlock && !taskArgs.lookbackDays) {
      throw new Error(
        `One of --from-block and --lookback-days must be specified`
      );
    }

    if (platformCount !== 1) {
      throw new Error(`Exactly one platform must be queried at a time`);
    }

    if (hre.network.name !== "mainnet" && hre.network.name !== "arbitrum") {
      // TODO: support other networks using addresses from deployConfig
      throw new Error(
        `Invalid network. Only mainnet data extraction is currently supported`
      );
    }

    if (taskArgs.borrow && !taskArgs.aave && !taskArgs.compound) {
      throw new Error(`Borrow rates are only supported for aave and compound`);
    }

    // calculate from and to blocks
    const currentBlock = await hre.ethers.provider.getBlock("latest");

    console.log("taskArgs.lookbackDays", taskArgs.lookbackDays);
    let toBlock: number = currentBlock.number;
    const fromBlock: number = taskArgs.fromBlock
      ? taskArgs.fromBlock
      : toBlock -
        taskArgs.lookbackDays *
          (taskArgs.glp ? blocksPerDayArbitrum : blocksPerDay);

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlock.number, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // compound
    let cToken: ICToken | undefined;

    // general
    let asset = "";

    // arrays for results
    const blocks: number[] = [];
    const timestamps: number[] = [];
    const rates: BigNumber[] = [];

    let generator: AsyncGenerator<Datum> | undefined;

    // compound
    if (taskArgs.compound && hre.network.name === "mainnet") {
      asset = `c${taskArgs.token}`;
      if (!Object.keys(cTokenAddresses).includes(asset)) {
        throw new Error(
          `Unrecognized error. Check that ${asset} is added to compound addresses!`
        );
      }

      cToken = (await hre.ethers.getContractAt(
        "ICToken",
        cTokenAddresses[asset as keyof typeof cTokenAddresses]
      )) as ICToken;

      const isEther = taskArgs.token === "ETH";

      generator = await buildCompoundDataGenerator(
        hre,
        cToken.address,
        undefined,
        taskArgs.borrow,
        isEther,
        { fromBlock, toBlock, blockInterval: taskArgs.blockInterval }
      );
    }

    // aave arbitrum
    if (taskArgs.aaveV3 && hre.network.name === "arbitrum") {
      if (taskArgs.token === "ETH") {
        asset = `aWETH`;
      } else {
        asset = `a${taskArgs.token}`;
      }

      if (!Object.keys(aTokenUnderlyingAddresses).includes(asset)) {
        throw new Error(
          `Unrecognized error. Check that ${asset} is added to aave addresses!`
        );
      }

      const underlyingTokenAddress =
        aTokenUnderlyingAddressesArbitrum[
          asset as keyof typeof aTokenUnderlyingAddressesArbitrum
        ];
      const lendingPool = (await hre.ethers.getContractAt(
        "IPool",
        "0x794a61358D6845594F94dc1DB02A252b5b4814aD" // arbitrum lending pool address
      )) as IPool;

      generator = await buildAaveV3DataGenerator(
        hre,
        lendingPool,
        underlyingTokenAddress,
        taskArgs.lookbackDays ??
          (currentBlock.number - taskArgs.fromBlock) / blocksPerDayArbitrum
      );
    }

    // aave v2 ethereum
    if (taskArgs.aave && hre.network.name === "mainnet") {
      if (taskArgs.token === "ETH") {
        asset = `aWETH`;
      } else {
        asset = `a${taskArgs.token}`;
      }

      if (!Object.keys(aTokenUnderlyingAddresses).includes(asset)) {
        throw new Error(
          `Unrecognized error. Check that ${asset} is added to aave addresses!`
        );
      }

      const underlyingTokenAddress =
        aTokenUnderlyingAddresses[
          asset as keyof typeof aTokenUnderlyingAddresses
        ];
      // TODO: fix
      generator = await buildAaveDataGenerator(
        hre,
        underlyingTokenAddress,
        undefined,
        taskArgs.borrow,
        { fromBlock, toBlock, blockInterval: taskArgs.blockInterval }
      );
    }

    // aave v3 ethereum
    if (taskArgs.aaveV3 && hre.network.name === "mainnet") {
      if (taskArgs.token === "ETH") {
        asset = `aWETH`;
      } else {
        asset = `a${taskArgs.token}`;
      }

      if (!Object.keys(aTokenUnderlyingAddresses).includes(asset)) {
        throw new Error(
          `Unrecognized error. Check that ${asset} is added to aave addresses!`
        );
      }

      const lendingPool = (await hre.ethers.getContractAt(
        "IPool",
        "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" // arbitrum lending pool address
      )) as IPool;

      const underlyingTokenAddress =
        aTokenUnderlyingAddresses[
          asset as keyof typeof aTokenUnderlyingAddresses
        ];
      // TODO: fix
      generator = await buildAaveV3DataGenerator(
        hre,
        lendingPool,
        underlyingTokenAddress,
        taskArgs.lookbackDays ??
          (currentBlock.number - taskArgs.fromBlock) / blocksPerDay
      );
    }

    // lido
    if (taskArgs.lido && hre.network.name === "mainnet") {
      const lidoOracle = (await hre.ethers.getContractAt(
        "ILidoOracle",
        lidoOracleAddress
      )) as ILidoOracle;

      const stEth = (await hre.ethers.getContractAt(
        "IStETH",
        lidoStEthMainnetAddress
      )) as IStETH;

      if (taskArgs.token === "ETH") {
        asset = `stETH`;
      } else {
        throw new Error(
          `Unrecognized error. Rocket supports only stETH but got ${asset}`
        );
      }

      generator = await buildLidoDataGenerator(hre, undefined, {
        stEth,
        lidoOracle,
        fromBlock,
        toBlock,
        blockInterval: taskArgs.blockInterval,
      });
    }

    // rocket
    if (taskArgs.rocket && hre.network.name === "mainnet") {
      const rocketNetworkBalances = (await hre.ethers.getContractAt(
        "IRocketNetworkBalances",
        RocketNetworkBalancesEthMainnet
      )) as IRocketNetworkBalances;

      const rocketEth = (await hre.ethers.getContractAt(
        "IRocketEth",
        rocketEthMainnetAddress
      )) as IRocketEth;

      if (taskArgs.token === "ETH") {
        asset = `rETH`;
      } else {
        throw new Error(
          `Unrecognized error. Rocket supports only rETH but got ${asset}`
        );
      }

      generator = await buildRocketDataGenerator(hre, undefined, {
        rocketNetworkBalances,
        rocketEth,
        fromBlock,
        toBlock,
        blockInterval: taskArgs.blockInterval,
      });
    }

    // glp
    if (taskArgs.glp && hre.network.name === "arbitrum") {
      asset = "GLP";
      generator = await buildGlpDataGenerator(hre, taskArgs.lookbackDays);
    }

    // populate output file
    const fs = require("fs");
    const file = taskArgs.borrow
      ? `historicalData/rates/f_borrow_${asset}.csv`
      : `historicalData/rates/f_${asset}.csv`;

    const header = "date,timestamp,liquidityIndex";

    fs.rmSync(file);
    fs.openSync(file, "w");
    fs.appendFileSync(file, header + "\n");
    console.log(`block,${header}`);

    if (generator) {
      // use the platform-specific generator initialised above to get the data points
      for await (const { blockNumber, timestamp, rate, error } of generator) {
        if (error) {
          console.log(`Error retrieving data for block ${blockNumber}`);
        } else {
          blocks.push(blockNumber);
          timestamps.push(timestamp);
          rates.push(rate);
          fs.appendFileSync(
            file,
            `${new Date(timestamp * 1000).toISOString()},${timestamp},${rate}\n`
          );
          console.log(
            `${blockNumber},${new Date(
              timestamp * 1000
            ).toISOString()},${timestamp},${rate}`
          );
        }
      }
    }

    // sanity checks
    if (blocks.length !== timestamps.length || blocks.length !== rates.length) {
      console.error("Mismatch in lengths");
    }

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i] <= blocks[i - 1]) {
        console.error("Unordered blocks", i);
        break;
      }
      if (timestamps[i] <= timestamps[i - 1]) {
        console.error("Unordered timestamps", i);
        break;
      }
      if (rates[i] < rates[i - 1]) {
        console.error("Unordered rates", i);
        console.log(rates[i].toString(), rates[i - 1].toString());
        break;
      }
    }

    return { timestamps, rates };
  });

module.exports = {};
