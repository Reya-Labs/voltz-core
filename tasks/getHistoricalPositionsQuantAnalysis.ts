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
  "getHistoricalPositionsQuantAnalysis",
  "Extracting Voltz position data for downstream quant analysis"
)
  .addParam("owner", "Address of the owner of the position")
  .addParam("tickLower", "Lower tick of a position")
  .addParam("tickUpper", "Upper tick of a position")
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
  .addParam("extra", "Extra descriptor for output csv", undefined, types.string)
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
    const file = `${taskArgs.pool}_QuantData${taskArgs.extra}.csv`;

    const header =
      "timestamp,block,tick,variable_rate,fixed_rate,variable_factor,position_margin,position_liquidity,fixed_token_balance,variable_token_balance,accumulated_fees,is_settled,position_requirement_liquidation,position_requirement_safety";

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
            (
              await baseRateOracle.callStatic.getApyFromTo(from, to, {
                blockTag: b,
              })
            )
              .div(BigNumber.from(10).pow(9))
              .toNumber() / 1e9;

          const variable_factor =
            (
              await baseRateOracle.callStatic.variableFactorNoCache(
                ethers.utils.parseEther(from.toString()),
                ethers.utils.parseEther(to.toString()),
                {
                  blockTag: b,
                }
              )
            )
              .div(BigNumber.from(10).pow(9))
              .toNumber() / 1e9;

          const fixed_rate = (tickToFixedRate(tick) / 100).toFixed(6);

          const positionRequirementSafety =
            await marginEngine.callStatic.getPositionMarginRequirement(
              taskArgs.owner,
              taskArgs.tickLower,
              taskArgs.tickUpper,
              false,
              {
                blockTag: b,
              }
            );

          const positionRequirementLiquidation =
            await marginEngine.callStatic.getPositionMarginRequirement(
              taskArgs.owner,
              taskArgs.tickLower,
              taskArgs.tickUpper,
              true,
              {
                blockTag: b,
              }
            );

          const positionInfo = await marginEngine.callStatic.getPosition(
            taskArgs.owner,
            taskArgs.tickLower,
            taskArgs.tickUpper,
            {
              blockTag: b,
            }
          );

          console.log(
            block.timestamp,
            b,
            tick,
            variable_rate,
            fixed_rate,
            variable_factor,
            positionInfo.margin,
            positionInfo._liquidity,
            positionInfo.fixedTokenBalance,
            positionInfo.variableTokenBalance,
            positionInfo.accumulatedFees,
            positionInfo.isSettled,
            positionRequirementLiquidation,
            positionRequirementSafety
          );

          fs.appendFileSync(
            file,
            `${
              block.timestamp
            },${b},${tick},${variable_rate},${fixed_rate},${variable_factor},${ethers.utils.formatEther(
              positionInfo.margin
            )},${ethers.utils.formatEther(
              positionInfo._liquidity
            )},${ethers.utils.formatEther(
              positionInfo.fixedTokenBalance
            )},${ethers.utils.formatEther(positionInfo.variableTokenBalance)},${
              positionInfo.isSettled
            },${ethers.utils.formatEther(
              positionInfo.accumulatedFees
            )},${ethers.utils.formatEther(
              positionRequirementLiquidation
            )},${ethers.utils.formatEther(positionRequirementSafety)}\n`
          );
        } catch (error) {
          console.log("Error: ", error);
        }
      }
    }
  });

module.exports = {};
