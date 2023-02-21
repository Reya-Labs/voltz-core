import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { Factory, Periphery } from "../typechain";
import "@nomiclabs/hardhat-ethers";
import { toBn } from "../test/helpers/toBn";

import * as poolAddresses from "../pool-addresses/mainnet.json";

import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../test/shared/utilities";
import { decodeInfoPostSwap } from "./utils/errorHandling";

const blocksPerDay = 6570; // 13.15 seconds per block

const factoryAddress = "0x6a7a5c3824508d03f0d2d24e0482bea39e08ccaf";

const scale = (x: number, decimals: number): BigNumber => {
  return toBn(x, decimals);
};

const descale = (x: BigNumber, decimals: number): number => {
  if (decimals >= 6) {
    return x.div(BigNumber.from(10).pow(decimals - 6)).toNumber() / 1e6;
  } else {
    return x.toNumber() / 10 ** decimals;
  }
};

const tickToFixedRate = (tick: number): number => {
  return 1.0001 ** -tick;
};

task("getTradeHistoricalData", "Retrieves trade historical data on Voltz")
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
  .addParam("pool", "Queried Pool", undefined, types.string)
  .setAction(async (taskArgs, hre) => {
    const factory = (await hre.ethers.getContractAt(
      "Factory",
      factoryAddress
    )) as Factory;

    if (taskArgs.pool === undefined) {
      return;
    }

    const poolInfo = poolAddresses[taskArgs.pool as keyof typeof poolAddresses];
    if (poolInfo === undefined) {
      return;
    }

    const marginEngineAddress = poolInfo.marginEngine;

    const decimals = poolInfo.decimals;
    console.log("decimals:", decimals);

    const deploymentBlockNumber = poolInfo.deploymentBlock;
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
      `This margin engine (${marginEngineAddress}) was deployed at ${new Date(
        deploymentBlock.timestamp * 1000
      ).toISOString()}.\n`
    );

    const fs = require("fs");
    const file = `historicalData/historicalTradeHistoricalData/${marginEngineAddress}.csv`;

    const header =
      "block,timestamp,fixed_rate,available_ft,slippage_ft_10,slippage_ft_100,slippage_ft_1000,slippage_ft_10000,available_vt,slippage_vt_10,slippage_vt_100,slippage_vt_1000,slippage_vt_10000";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    console.log("network name:", hre.network.name);
    console.log("current block", hre.ethers.provider.blockNumber);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const peripheryAddress = await factory.periphery({ blockTag: b });
      console.log(peripheryAddress);

      const periphery = (await hre.ethers.getContractAt(
        "Periphery",
        peripheryAddress
      )) as Periphery;

      const block = await hre.ethers.provider.getBlock(b);

      if (b >= deploymentBlockNumber) {
        try {
          const tick = await periphery.getCurrentTick(marginEngineAddress, {
            blockTag: b,
          });

          const ft_info: {
            availableNotional: BigNumber;
            tickAfter: number;
          }[] = [];
          const vt_info: {
            availableNotional: BigNumber;
            tickAfter: number;
          }[] = [];

          for (const notional of [1_000_000_000_000, 10, 100, 1_000, 10_000]) {
            {
              const ft: {
                availableNotional: BigNumber;
                tickAfter: number;
              } = {
                availableNotional: BigNumber.from(0),
                tickAfter: 0,
              };
              await periphery.callStatic
                .swap(
                  {
                    marginEngine: marginEngineAddress,
                    isFT: true,
                    notional: scale(notional, decimals),
                    sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
                    tickLower: 0,
                    tickUpper: 60,
                    marginDelta: "0",
                  },
                  {
                    blockTag: b,
                  }
                )
                .then((result) => {
                  ft.availableNotional = result._variableTokenDelta;
                  ft.tickAfter = result._tickAfter;
                })
                .catch((error) => {
                  const result = decodeInfoPostSwap(error);
                  ft.availableNotional = result.availableNotional;
                  ft.tickAfter = result.tick;
                });

              ft_info.push(ft);
            }

            {
              const vt: {
                availableNotional: BigNumber;
                tickAfter: number;
              } = {
                availableNotional: BigNumber.from(0),
                tickAfter: 0,
              };
              await periphery.callStatic
                .swap(
                  {
                    marginEngine: marginEngineAddress,
                    isFT: false,
                    notional: scale(notional, decimals),
                    sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
                    tickLower: 0,
                    tickUpper: 60,
                    marginDelta: "0",
                  },
                  {
                    blockTag: b,
                  }
                )
                .then((result) => {
                  vt.availableNotional = result._variableTokenDelta;
                  vt.tickAfter = result._tickAfter;
                })
                .catch((error) => {
                  const result = decodeInfoPostSwap(error);
                  vt.availableNotional = result.availableNotional;
                  vt.tickAfter = result.tick;
                });

              vt_info.push(vt);
            }
          }

          let response = `${b},${block.timestamp},${(
            tickToFixedRate(tick) / 100
          ).toFixed(6)}`;

          for (let i = 0; i < 5; i++) {
            if (i > 0) {
              const slippage = Math.abs(
                tickToFixedRate(ft_info[i].tickAfter) - tickToFixedRate(tick)
              );
              response = response + "," + (slippage / 100).toFixed(6);
            } else {
              response =
                response +
                "," +
                Math.abs(descale(ft_info[i].availableNotional, decimals));
            }
          }

          for (let i = 0; i < 5; i++) {
            if (i > 0) {
              const slippage = Math.abs(
                tickToFixedRate(vt_info[i].tickAfter) - tickToFixedRate(tick)
              );
              response = response + "," + (slippage / 100).toFixed(6);
            } else {
              response =
                response +
                "," +
                Math.abs(descale(vt_info[i].availableNotional, decimals));
            }
          }

          fs.appendFileSync(file, `${response}\n`);
          console.log(response);
        } catch (error) {
          console.log("error:", error);
        }
      }
    }
  });

module.exports = {};
