import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { BaseRateOracle } from "../typechain";
import { getRateOracleByNameOrAddress } from "./utils/helpers";

// eslint-disable-next-line no-unused-vars
enum FETCH_STATUS {
  // eslint-disable-next-line no-unused-vars
  FAILURE,
  // eslint-disable-next-line no-unused-vars
  SUCCESS,
}

const blocksPerDay = 6570; // 13.15 seconds per block

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
    const rateOracle = (await getRateOracleByNameOrAddress(
      hre,
      taskArgs.rateOracle
    )) as BaseRateOracle;

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    let toBlock = currentBlockNumber;
    const fromBlock = taskArgs.fromBlock;

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlockNumber, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    const blocks: number[] = [];
    const timestamps: number[] = [];
    const apys: number[] = [];
    const liquidityIndices: BigNumber[] = [];

    const fs = require("fs");
    const file = `historicalData/rateOracleApy/${taskArgs.rateOracle}.csv`;

    const header = `block,timestamp,datetime,liquidityIndex,${taskArgs.lookbackWindow}-second APY`;

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    // advance time by 1 day for Rocket to pick the right block time average

    // if (hre.network.name === 'localhost') {
    //     for (let i = 0; i < blocksPerDay; i++) {
    //     await hre.network.provider.send("evm_mine", []);
    //     }
    // }

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);
      let fetch: FETCH_STATUS = FETCH_STATUS.FAILURE;

      try {
        // console.log(
        //   "getting apy from",
        //   block.timestamp - taskArgs.lookbackWindow,
        //   "to",
        //   block.timestamp,
        //   " from RateOracle at ",
        //   rateOracle.address
        // );

        let liquidityIndexTimestamp, liquidityIndex;
        try {
          [liquidityIndexTimestamp, liquidityIndex] =
            await rateOracle.getLastUpdatedRate({
              blockTag: b,
            });
        } catch (error) {
          liquidityIndex = BigNumber.from("-1");
          liquidityIndexTimestamp = null;
        }

        const apy = await rateOracle.getApyFromTo(
          block.timestamp - taskArgs.lookbackWindow,
          block.timestamp,
          {
            blockTag: b,
          }
        );

        blocks.push(b);
        timestamps.push(liquidityIndexTimestamp || block.timestamp);
        liquidityIndices.push(liquidityIndex);
        apys.push(apy.div(BigNumber.from(10).pow(9)).toNumber() / 1e9);

        fetch = FETCH_STATUS.SUCCESS;
      } catch (error) {
        // console.log("error:", error);
      }

      switch (fetch) {
        case FETCH_STATUS.SUCCESS: {
          const lastBlock = blocks[blocks.length - 1];
          const lastTimestamp = timestamps[timestamps.length - 1];
          const lastApy = apys[apys.length - 1];
          const liquidityIndex = liquidityIndices[liquidityIndices.length - 1];

          const output = `${lastBlock},${lastTimestamp},${new Date(
            lastTimestamp * 1000
          ).toISOString()},${liquidityIndex.toString()},${lastApy}`;
          fs.appendFileSync(file, output + "\n");
          console.log(output);

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
