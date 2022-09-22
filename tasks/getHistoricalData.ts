import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import {
  ICToken,
  IERC20Minimal,
  ILidoOracle,
  IRocketEth,
  IRocketNetworkBalances,
  IStETH,
} from "../typechain";
import { BigNumber } from "ethers";
import "@nomiclabs/hardhat-ethers";
import {
  mainnetAaveDataGenerator,
  Datum,
} from "../historicalData/generators/aave";

// eslint-disable-next-line no-unused-vars
enum FETCH_STATUS {
  // eslint-disable-next-line no-unused-vars
  FAILURE,
  // eslint-disable-next-line no-unused-vars
  ALREADY_FETCHED,
  // eslint-disable-next-line no-unused-vars
  SUCCESS,
}

// lido
const lidoStEthMainnetAddress = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const lidoStEthMainnetStartBlock = 11593216;
const lidoOracleAddress = "0x442af784a788a5bd6f42a01ebe9f287a871243fb";

// rocket
const rocketEthMainnetAddress = "0xae78736Cd615f374D3085123A210448E74Fc6393";
const rocketEthnMainnetStartBlock = 13326304;
const RocketNetworkBalancesEthMainnet =
  "0x138313f102ce9a0662f826fca977e3ab4d6e5539";

// compound
const compoundMainnetStartBlock = 7710760; // cUSDC deployment
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

const blocksPerDay = 5 * 60 * 24; // 12 seconds per block = 5 blocks per minute

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
    taskArgs.aave && platformCount++;
    taskArgs.compound && platformCount++;
    taskArgs.rocket && platformCount++;
    taskArgs.lido && platformCount++;

    if (!taskArgs.fromBlock && !taskArgs.lookbackDays) {
      throw new Error(
        `One of --from-block and --lookback-days must be specified`
      );
    }

    if (platformCount !== 1) {
      throw new Error(`Exactly one platform must be queried at a time`);
    }

    if (taskArgs.borrow && !taskArgs.aave && !taskArgs.compound) {
      throw new Error(`Borrow rates are only supported for aave and compound`);
    }

    // calculate from and to blocks
    const currentBlock = await hre.ethers.provider.getBlock("latest");

    let toBlock: number = currentBlock.number;
    const fromBlock: number = taskArgs.fromBlock
      ? taskArgs.fromBlock
      : toBlock - taskArgs.lookbackDays * blocksPerDay;

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlock.number, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // lido
    const stETH = (await hre.ethers.getContractAt(
      "IStETH",
      lidoStEthMainnetAddress
    )) as IStETH;

    // eslint-disable-next-line no-unused-vars
    const lidoOracle = (await hre.ethers.getContractAt(
      "ILidoOracle",
      lidoOracleAddress
    )) as ILidoOracle;

    // rocket
    const rocketNetworkBalancesEth = (await hre.ethers.getContractAt(
      "IRocketNetworkBalances",
      RocketNetworkBalancesEthMainnet
    )) as IRocketNetworkBalances;

    const rocketEth = (await hre.ethers.getContractAt(
      "IRocketEth",
      rocketEthMainnetAddress
    )) as IRocketEth;

    // compound
    let cToken: ICToken | undefined;

    // general
    let asset = "";
    let decimals = 0;

    // arrays for results
    const blocks: number[] = [];
    const timestamps: number[] = [];
    const rates: BigNumber[] = [];

    let generator: AsyncGenerator<Datum> | undefined;

    // compound
    if (taskArgs.compound) {
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

      if (taskArgs.token === "ETH") {
        decimals = 18;
      } else {
        const underlying = (await hre.ethers.getContractAt(
          "IERC20Minimal",
          await cToken.underlying()
        )) as IERC20Minimal;

        decimals = await underlying.decimals();
      }
    }

    // aave
    if (taskArgs.aave) {
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
      generator = await mainnetAaveDataGenerator(
        hre,
        underlyingTokenAddress,
        undefined,
        taskArgs.borrow,
        { fromBlock, toBlock, blockInterval: taskArgs.blockInterval }
      );
      // no need to get decimals
    }

    // lido
    if (taskArgs.lido) {
      if (taskArgs.token === "ETH") {
        asset = `stETH`;
      } else {
        throw new Error(
          `Unrecognized error. Rocket supports only stETH but got ${asset}`
        );
      }

      // no need to get decimals
    }

    // rocket
    if (taskArgs.rocket) {
      if (taskArgs.token === "ETH") {
        asset = `rETH`;
      } else {
        throw new Error(
          `Unrecognized error. Rocket supports only rETH but got ${asset}`
        );
      }

      // no need to get decimals
    }

    // populate output file
    const fs = require("fs");
    const file = taskArgs.borrow
      ? `historicalData/rates/f_borrow_${asset}.csv`
      : `historicalData/rates/f_${asset}.csv`;

    const header = "date,timestamp,liquidityIndex";

    fs.appendFileSync(file, header + "\n");
    console.log(`block,${header}`);

    if (generator) {
      // use the generator
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
    } else {
      // Old approach - iterate in this file
    }

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);
      let fetch: FETCH_STATUS = FETCH_STATUS.FAILURE;

      // Lido
      if (taskArgs.lido && !taskArgs.borrow) {
        if (b >= lidoStEthMainnetStartBlock) {
          const r = await stETH.getPooledEthByShares(toBn(1, 27), {
            blockTag: b,
          });

          const epoch = await lidoOracle.getLastCompletedEpochId({
            blockTag: b,
          });

          const beaconSpec = await lidoOracle.getBeaconSpec({
            blockTag: b,
          });

          const lastCompletedTime = beaconSpec.genesisTime.add(
            epoch.mul(beaconSpec.slotsPerEpoch).mul(beaconSpec.secondsPerSlot)
          );

          if (
            timestamps.length === 0 ||
            timestamps[timestamps.length - 1] < lastCompletedTime.toNumber()
          ) {
            blocks.push(b);
            timestamps.push(lastCompletedTime.toNumber());
            rates.push(r);
            fetch = FETCH_STATUS.SUCCESS;
          } else {
            fetch = FETCH_STATUS.ALREADY_FETCHED;
          }
        }
      }

      // Rocket
      if (taskArgs.rocket && !taskArgs.borrow) {
        if (b >= rocketEthnMainnetStartBlock) {
          const balancesBlockNumber =
            await rocketNetworkBalancesEth.getBalancesBlock({
              blockTag: b,
            });

          const balancesBlock = await hre.ethers.provider.getBlock(
            balancesBlockNumber.toNumber()
          );

          const r = await rocketEth.getEthValue(toBn(1, 27), {
            blockTag: b,
          });

          if (
            blocks.length === 0 ||
            blocks[blocks.length - 1] < balancesBlockNumber.toNumber()
          ) {
            blocks.push(b);
            timestamps.push(balancesBlock.timestamp);
            rates.push(r);
            fetch = FETCH_STATUS.SUCCESS;
          } else {
            fetch = FETCH_STATUS.ALREADY_FETCHED;
          }
        }
      }

      // Compound
      if (taskArgs.compound) {
        if (b >= compoundMainnetStartBlock) {
          try {
            if (cToken && decimals) {
              if (taskArgs.borrow) {
                const borrowRateMantissa = await cToken.borrowRatePerBlock({
                  blockTag: b,
                });
                const accrualBlockNumber = await cToken.accrualBlockNumber({
                  blockTag: b,
                });
                const blockDelta = BigNumber.from(b).sub(accrualBlockNumber);
                const simpleInterestFactor = borrowRateMantissa.mul(
                  BigNumber.from(blockDelta)
                );
                const borrowIndexPrior = await cToken.borrowIndex({
                  blockTag: b,
                });
                const r = simpleInterestFactor
                  .mul(borrowIndexPrior)
                  .div(BigNumber.from(10).pow(18)) // all the above are in wad
                  .add(borrowIndexPrior)
                  .mul(BigNumber.from(10).pow(9)); // scale to ray

                blocks.push(b);
                timestamps.push(block.timestamp);
                rates.push(r);
                fetch = FETCH_STATUS.SUCCESS;

                // Calculation of instantaneous APY per per https://compound.finance/docs#protocol-math
                // const ethMantissa = 1e18;
                // const compoundBlocksPerDay = 6570; // 13.15 seconds per block
                // const compoundDaysPerYear = 365;
                // const instantaneousBorrowApy =
                //   (Math.pow(
                //     (borrowRateMantissa.toNumber() / ethMantissa) *
                //       compoundBlocksPerDay +
                //       1,
                //     compoundDaysPerYear
                //   ) -
                //     1) *
                //   100;
                // console.log(
                //   `Instantaneous borrow APY is ${instantaneousBorrowApy}`
                // );
              } else {
                let r = await cToken.exchangeRateStored({
                  blockTag: b,
                });
                if (decimals > 17) {
                  r = r.div(BigNumber.from(10).pow(decimals - 17));
                } else if (decimals < 17) {
                  r = r.mul(BigNumber.from(10).pow(17 - decimals));
                }

                blocks.push(b);
                timestamps.push(block.timestamp);
                rates.push(r);
                fetch = FETCH_STATUS.SUCCESS;
              }
            }
          } catch (e) {
            // console.log("Could not get rate for cToken: ", asset);
          }
        } else {
          // Before start block but we need a placeholder to keep things aligned
        }
      }

      // Aave
      if (!taskArgs.aave) {
        switch (fetch) {
          case FETCH_STATUS.SUCCESS: {
            const lastBlock = blocks[blocks.length - 1];
            const lastTimestamp = timestamps[timestamps.length - 1];
            const lastRate = rates[rates.length - 1];

            fs.appendFileSync(
              file,
              `${new Date(
                lastTimestamp * 1000
              ).toISOString()},${lastTimestamp},${lastRate}\n`
            );
            console.log(
              `${lastBlock},${lastTimestamp},${new Date(
                lastTimestamp * 1000
              ).toISOString()},${lastRate}`
            );
            break;
          }
          case FETCH_STATUS.ALREADY_FETCHED: {
            console.log("Already fetched.");
            break;
          }
          case FETCH_STATUS.FAILURE: {
            console.log(`Couldn't fetch at block ${b}`);
            break;
          }
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
      if (rates[i] <= rates[i - 1]) {
        console.error("Unordered rates", i);
        break;
      }
    }

    return { timestamps, rates };
  });

// const getHistoricalData: ActionType<MinimumBuildArgs> = async function (
//   { protocol, fromBlock, blockInterval, toBlock },
//   { config, network, run }
// ): Promise<Data> {
//   return [];
// };

// subtask(TASK_GET_HISTORICAL_DATA_GET_DATA)
//   .addParam("protocol", undefined, undefined, types.string)
//   .addParam("fromBlock", undefined, undefined, types.int)
//   .addParam("blockInterval", undefined, undefined, types.int)
//   .addParam("toBlock", undefined, undefined, types.int)
//   .setAction(getHistoricalData);

// subtask(TASK_GET_HISTORICAL_DATA_PRINT_DATA)
//   .addParam("address", undefined, undefined, types.string)
//   .addParam("protocol", undefined, undefined, types.string)
//   .addOptionalParam("contract", undefined, undefined, types.string)
//   .addOptionalParam("libraries", undefined, {}, types.any)
//   .setAction(getHistoricalData);

module.exports = {};
