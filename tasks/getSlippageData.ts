import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { Factory, IMarginEngine, Periphery } from "../typechain";

import { decodeInfoPostSwap } from "./utils/errorHandling";
import { getPool } from "../poolConfigs/pool-addresses/pools";

type TradeInfo = {
  availableNotional: BigNumber;
  tickAfter: number;
};

const blocksPerDay = 7200;

const formatNumber = (value: number): string => {
  return value.toFixed(4);
};

const tickToFixedRate = (tick: number): number => {
  return 1.0001 ** -tick;
};

// Description:
//   This task fetches the APYs and liquidity indices of a rate oracle and outputs the results into .csv file

// Example:
//   ``npx hardhat getSlippageData --network arbitrum --pool glpETH_v1 --block-interval 432000``

// Estimated execution time: 100s per 20 data points

task("getSlippageData", "Retrieves trade historical data on Voltz")
  .addParam("pool", "Pool name")
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
  .setAction(async (taskArgs, hre) => {
    const start = Date.now();
    const fs = require("fs");

    // Fetch factory
    const factory = (await hre.ethers.getContract("Factory")) as Factory;

    // Retrieve pool details
    const poolDetails = getPool(hre.network.name, taskArgs.pool);

    // Fetch margin engine
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      poolDetails.marginEngine
    )) as IMarginEngine;

    // Retrieve term end of the pool
    const termEndWad = await marginEngine.termEndTimestampWad();
    const timeEnd = Number(hre.ethers.utils.formatUnits(termEndWad, 18));

    // Compute starting and ending blocks
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    let fromBlock = poolDetails.deploymentBlock;
    let toBlock = currentBlockNumber;

    if (taskArgs.fromBlock) {
      fromBlock = Math.max(poolDetails.deploymentBlock, taskArgs.fromBlock);
    }

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlockNumber, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    // Data of the task
    const notionals = [1_000_000_000_000].concat([10, 100, 1_000, 10_000]);

    const entries: [number, boolean][] = [
      [0, true],
      [1, false],
    ];

    // Create the output file
    const exportFolder = `historicalData/historicalTradeHistoricalData`;

    // Check if folder exists, or create one if it doesn't
    if (!fs.existsSync(exportFolder)) {
      fs.mkdirSync(exportFolder, { recursive: true });
    }

    const file = `${exportFolder}/${hre.network.name}-${taskArgs.pool}.csv`;

    let header = "block,timestamp,fixed_rate";
    for (const [_, isFT] of entries) {
      const tag = isFT ? "ft" : "vt";
      header += `,available_${tag}`;
      for (const notional of notionals.slice(1)) {
        header += `,slippage_${tag}_${notional}`;
      }
    }

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      // Get information of block b
      const block = await hre.ethers.provider.getBlock(b);

      if (block.timestamp >= timeEnd) {
        console.warn(
          `Stopping here. The block timestamp is already after term end.`
        );
        break;
      }

      // Fetch periphery at block b
      const peripheryAddress = await factory.periphery({ blockTag: b });
      const periphery = (await hre.ethers.getContractAt(
        "Periphery",
        peripheryAddress
      )) as Periphery;

      try {
        // Get current tick of the pool
        const tick = await periphery.getCurrentTick(poolDetails.marginEngine, {
          blockTag: b,
        });

        // Keeper of FT trade information
        const tradeInfo: TradeInfo[][] = [[], []];

        for (const [i, isFT] of entries) {
          for (const notional of notionals) {
            // Initialize trade information
            const trade: TradeInfo = {
              availableNotional: BigNumber.from(0),
              tickAfter: 0,
            };

            // Simulate swap
            await periphery.callStatic
              .swap(
                {
                  marginEngine: poolDetails.marginEngine,
                  isFT: isFT,
                  notional: hre.ethers.utils.parseUnits(
                    notional.toFixed(poolDetails.decimals),
                    poolDetails.decimals
                  ),
                  sqrtPriceLimitX96: 0,
                  tickLower: 0,
                  tickUpper: 60,
                  marginDelta: "0",
                },
                {
                  blockTag: b,
                }
              )
              .then((result) => {
                trade.availableNotional = result._variableTokenDelta;
                trade.tickAfter = result._tickAfter;
              })
              .catch((error) => {
                const result = decodeInfoPostSwap(error);
                trade.availableNotional = result.availableNotional;
                trade.tickAfter = result.tick;
              });

            tradeInfo[i].push(trade);
          }
        }

        let response = `${b},${block.timestamp},${formatNumber(
          tickToFixedRate(tick)
        )}%`;

        for (let j = 0; j < entries.length; ++j) {
          for (let i = 0; i < notionals.length; i++) {
            if (i === 0) {
              const availableNotional = Math.abs(
                Number(
                  hre.ethers.utils.formatUnits(
                    tradeInfo[j][i].availableNotional,
                    poolDetails.decimals
                  )
                )
              );
              response = response + "," + formatNumber(availableNotional);

              continue;
            }

            const slippage = Math.abs(
              tickToFixedRate(tradeInfo[j][i].tickAfter) - tickToFixedRate(tick)
            );
            response = response + "," + formatNumber(slippage) + "%";
          }
        }

        fs.appendFileSync(file, `${response}\n`);
        console.log(response);
      } catch (error) {
        console.warn(`Couldn't fetch at block ${b}`);
      }
    }

    const end = Date.now();
    console.log(`Finished in ${(end - start) / 1000} seconds.`);
  });

module.exports = {};
