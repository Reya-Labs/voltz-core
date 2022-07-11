import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { BaseRateOracle, IRocketNetworkBalances } from "../typechain";

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
  "Predicts the IRS addresses used by a not-yet-created IRS instance"
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
    "rateOracleAddress",
    "Queried Rate Oracle",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const rateOracle = (await hre.ethers.getContractAt(
      "BaseRateOracle",
      taskArgs.rateOracleAddress
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

    const RocketNetworkBalancesEthMainnet =
      "0x138313f102ce9a0662f826fca977e3ab4d6e5539";

    // rocket
    const rocketNetworkBalancesEth = (await hre.ethers.getContractAt(
      "IRocketNetworkBalances",
      RocketNetworkBalancesEthMainnet
    )) as IRocketNetworkBalances;

    const blocks: number[] = [];
    const timestamps: number[] = [];
    const apys: number[] = [];

    const fs = require("fs");
    const file = `historicalData/rateOracleApy/${rateOracle.address}.csv`;

    const header = "block,timestamp,apy";

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
        console.log(
          "getting apy from",
          block.timestamp - taskArgs.lookbackWindow,
          "to",
          block.timestamp
        );

        const apy = await rateOracle.getApyFromTo(
          block.timestamp - taskArgs.lookbackWindow,
          block.timestamp,
          {
            blockTag: b,
          }
        );

        const blockSlope = await rateOracle.getBlockSlope({
          blockTag: b,
        });

        console.log(
          "block slope",
          blockSlope.timeChange / blockSlope.blockChange.toNumber()
        );

        const rateSlope = await rateOracle.getLastRateSlope({
          blockTag: b,
        });

        console.log("rate slope", rateSlope.rateChange.toString(), rateSlope.timeChange);

        const lastUpdatedRate = await rateOracle.getLastUpdatedRate({
          blockTag: b,
        });

        console.log(
          "last rate:",
          lastUpdatedRate.rate.toString(),
          lastUpdatedRate.timestamp.toString()
        );

        const balancesBlock = await rocketNetworkBalancesEth.getBalancesBlock({
          blockTag: b,
        });
        console.log("balancesBlock:", balancesBlock.toString());

        console.log(
          "actual timestamp:",
          (
            await hre.ethers.provider.getBlock(
              await hre.ethers.provider.getBlockNumber()
            )
          ).timestamp
        );
        blocks.push(b);
        timestamps.push(block.timestamp);
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

          fs.appendFileSync(file, `${lastBlock},${lastTimestamp},${lastApy}\n`);
          console.log(
            `${lastBlock},${lastTimestamp},${new Date(
              lastTimestamp * 1000
            ).toISOString()},${lastApy}`
          );

          if (lastApy < 0.02) {
            return;
          }

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
