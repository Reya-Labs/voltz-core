import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { IMarginEngine } from "../typechain";

// eslint-disable-next-line no-unused-vars
enum FETCH_STATUS {
  // eslint-disable-next-line no-unused-vars
  FAILURE,
  // eslint-disable-next-line no-unused-vars
  SUCCESS,
}

const blocksPerDay = 6570; // 13.15 seconds per block

const deploymentBlocks = {
  "0x21F9151d6e06f834751b614C2Ff40Fc28811B235": 15058080,
};

const getDeploymentBlock = (address: string): number => {
  if (!Object.keys(deploymentBlocks).includes(address)) {
    throw new Error(
      `Unrecognized error. Check the deployment block of ${address}!`
    );
  }
  return deploymentBlocks[address as keyof typeof deploymentBlocks];
};

task(
  "getHistoricalApy",
  "Predicts the IRS addresses used by a not-yet-created IRS instance"
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
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .addParam(
    "marginEngineAddress",
    "Queried Margin Engine Address",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as IMarginEngine;

    const deploymentBlockNumber = getDeploymentBlock(marginEngine.address);
    if (!deploymentBlockNumber) {
      throw new Error("Couldn't fetch deployment block number");
    }

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

    const deploymentBlock = await hre.ethers.provider.getBlock(
      deploymentBlockNumber
    );

    console.log(
      `This margin engine (${marginEngine.address}) was deployed at ${new Date(
        deploymentBlock.timestamp * 1000
      ).toISOString()}.\n`
    );

    const blocks: number[] = [];
    const timestamps: number[] = [];
    const apys: number[] = [];

    const fs = require("fs");
    const file = `historicalData/historicalApy/${marginEngine.address}.csv`;

    const header = "block,timestamp,apy";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

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
        } catch (error) {
          // console.log("error:", error);
        }
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
