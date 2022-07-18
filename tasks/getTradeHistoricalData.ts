import { task, types } from "hardhat/config";
import { BigNumber, ethers } from "ethers";
import { IPeriphery } from "../typechain";
import "@nomiclabs/hardhat-ethers";
import { toBn } from "../test/helpers/toBn";

import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../test/shared/utilities";
import { decodeInfoPostSwap } from "./errorHandling";

const blocksPerDay = 6570; // 13.15 seconds per block

const peripheryAddress = "0x13E9053D9090ed6a1FAE3f59f9bD3C1FCa4c5726";
// const peripheryAddress = "0x6a7a5c3824508d03f0d2d24e0482bea39e08ccaf";

const deploymentBlocks = {
  "0x9ea5Cfd876260eDadaB461f013c24092dDBD531d": 14883716,
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

task("getTradeHistoricalData", "Get trader historical data")
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
    const periphery = (await hre.ethers.getContractAt(
      "Periphery",
      peripheryAddress
    )) as IPeriphery;

    const marginEngineAddress = taskArgs.marginEngineAddress;

    const deploymentBlockNumber = getDeploymentBlock(marginEngineAddress);
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
      "block,timestamp,fixed_rate,available_ft,slippage_ft_10000,slippage_ft_100000,slippage_ft_1000000,slippage_ft_10000000,available_vt,slippage_vt_10000,slippage_vt_100000,slippage_vt_1000000,slippage_vt_10000000";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
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

          for (const notional of [
            1_000_000_000_000, 10_000, 100_000, 1_000_000, 10_000_000,
          ]) {
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
                    notional: toBn(notional),
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
                  const result = decodeInfoPostSwap(error, "MAINNET");
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
                    notional: toBn(notional),
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
                  const result = decodeInfoPostSwap(error, "MAINNET");
                  vt.availableNotional = result.availableNotional;
                  vt.tickAfter = result.tick;
                });

              vt_info.push(vt);
            }
          }

          let response = `${b},${block.timestamp},${Math.pow(
            1.0001,
            -tick
          ).toFixed(3)}`;

          for (let i = 0; i < 5; i++) {
            if (i > 0) {
              response = response + "," + ft_info[i].tickAfter.toString();
            } else {
              response =
                response +
                "," +
                ethers.utils.formatEther(ft_info[i].availableNotional);
            }
          }

          for (let i = 0; i < 5; i++) {
            if (i > 0) {
              response = response + "," + vt_info[i].tickAfter.toString();
            } else {
              response =
                response +
                "," +
                ethers.utils.formatEther(vt_info[i].availableNotional);
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
