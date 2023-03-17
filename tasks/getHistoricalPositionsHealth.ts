import { task, types } from "hardhat/config";
import { IVAMM, MarginEngine } from "../typechain";

const blocksPerDay = 6570; // 13.15 seconds per block

task("getHistoricalPositionsHealth", "Check positions")
  .addParam("marginEngineAddress", "Margin Engine Address")
  .addParam("owner", "Address of the owner of the position")
  .addParam("tickLower", "Lower tick of a position")
  .addParam("tickUpper", "Upper tick of a position")
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
  .setAction(async (taskArgs, hre) => {
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as MarginEngine;

    const vamm = (await hre.ethers.getContractAt(
      "VAMM",
      await marginEngine.vamm()
    )) as IVAMM;

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    const fromBlock = taskArgs.fromBlock;
    const toBlock = currentBlockNumber;

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    const fs = require("fs");
    const file = `${taskArgs.marginEngineAddress}.csv`;

    const header =
      "timestamp,block,tick,position_margin,position_liquidity,variable_token_balance,position_requirement_liquidation,position_requirement_safety,status";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);

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

      let status = "HEALTHY";
      if (positionInfo.margin.lte(positionRequirementLiquidation)) {
        status = "DANGER";
      } else if (positionInfo.margin.lte(positionRequirementSafety)) {
        status = "WARNING";
      }

      const tick = (await vamm.vammVars({ blockTag: b })).tick;

      console.log(
        b,
        block.timestamp,
        positionInfo.margin,
        positionInfo._liquidity,
        positionInfo.variableTokenBalance,
        positionRequirementLiquidation,
        positionRequirementSafety,
        status
      );

      fs.appendFileSync(
        file,
        `${block.timestamp},${b},${tick},${hre.ethers.utils.formatEther(
          positionInfo.margin
        )},${hre.ethers.utils.formatEther(
          positionInfo._liquidity
        )},${hre.ethers.utils.formatEther(
          positionInfo.variableTokenBalance
        )},${hre.ethers.utils.formatEther(
          positionRequirementLiquidation
        )},${hre.ethers.utils.formatEther(
          positionRequirementSafety
        )},${status}\n`
      );
    }
  });

module.exports = {};
