
import { task, types } from "hardhat/config";
import { MarginEngine, BaseRateOracle, Factory, Periphery } from "../typechain";
import { BigNumber, ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import * as poolAddresses from "../pool-addresses/mainnet.json";

// We will want to extract the fixed rate
const tickToFixedRate = (tick: number): number => {
  return 1.0001 ** -tick;
};

const blocksPerDay = 6570; // 13.15 seconds per block
const blocksPerHour = 300; // Use for historical APY extaction
const factoryAddress = "0x6a7a5c3824508d03f0d2d24e0482bea39e08ccaf"; // Address for calling the Factor contract

task(
  "getAllRates",
  "Extracting Voltz fixed and variable rates for different pools"
)
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
  .addParam("pool", "Queried Pool", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const poolInfo = poolAddresses[taskArgs.pool as keyof typeof poolAddresses];
    if (poolInfo === undefined) {
      return;
    }

    const marginEngineAddress = poolInfo.marginEngine;

    const deploymentBlockNumber = poolInfo.deploymentBlock;
    if (!deploymentBlockNumber) {
      throw new Error("Couldn't fetch deployment block number");
    }

    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      marginEngineAddress
    )) as MarginEngine;

    const factory = (await hre.ethers.getContractAt(
      "Factory",
      factoryAddress
    )) as Factory;

    // Need to run on mainnet
    if (hre.network.name !== "mainnet") {
      throw new Error(
        "Invalid network. Only mainnet data extraction is currently supported"
      );
    }

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    let fromBlock = deploymentBlockNumber;
    const toBlock = currentBlockNumber;

    // Reset to the user-provided block, if it is povided
    if (taskArgs.fromBlock) {
      fromBlock = taskArgs.fromBlock;
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    const fs = require("fs");
    const file = `${taskArgs.pool}_RateData.csv`;

    const header =
      "timestamp,block,tick,variable_rate,fixed_rate"
    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const peripheryAddress = await factory.periphery({ blockTag: b });

      const periphery = (await hre.ethers.getContractAt(
        "Periphery",
        peripheryAddress
      )) as Periphery;

      const baseRateOracle = (await hre.ethers.getContractAt(
        "BaseRateOracle",
        await marginEngine.rateOracle({ blockTag: b })
      )) as BaseRateOracle;

      const block = await hre.ethers.provider.getBlock(b);

      if (b >= deploymentBlockNumber) {
        try {
          const tick = await periphery.getCurrentTick(marginEngineAddress, {
            blockTag: b,
          });

          const to = BigNumber.from(
            (await hre.ethers.provider.getBlock(b)).timestamp
          );

          const from = BigNumber.from(
            (await hre.ethers.provider.getBlock(b - 28 * blocksPerHour))
              .timestamp
          );

          const variable_rate = 
            (await baseRateOracle.callStatic.getApyFromTo(
              from,
              to,
              {
                blockTag: b,
              }
            )).div(BigNumber.from(10).pow(9)).toNumber() / 1e9;

          const fixed_rate = (tickToFixedRate(tick)/100).toFixed(6);

          console.log(
            block.timestamp,
            b,
            tick,
            variable_rate,
            fixed_rate,
          );

          fs.appendFileSync(
            file,
            `${block.timestamp},${b},${tick},${variable_rate},${fixed_rate}\n`);
        } catch (error) {
          console.log("Error: ", error);
        }
      }
    }
  });

module.exports = {};
