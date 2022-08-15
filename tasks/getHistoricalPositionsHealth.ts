import { task, types } from "hardhat/config";
import { IVAMM, MarginEngine } from "../typechain";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";

const blocksPerDay = 6570; // 13.15 seconds per block

const position = {
  marginEngineAddress: "0x21f9151d6e06f834751b614c2ff40fc28811b235",
  owner: "0x5bb4f05ff5235554204e3cd9ba46c3d5af422a0f",
  tickLower: "-17880",
  tickUpper: "-11640",
};

task("getHistoricalPositionsHealth", "Check positions")
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
      position.marginEngineAddress
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
    const file = `${position.marginEngineAddress}.csv`;

    const header =
      "timestamp,block,tick,position_margin,position_liquidity,variable_token_balance,position_requirement_liquidation,position_requirement_safety,status";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);

      const positionRequirementSafety =
        await marginEngine.callStatic.getPositionMarginRequirement(
          position.owner,
          position.tickLower,
          position.tickUpper,
          false,
          {
            blockTag: b,
          }
        );

      const positionRequirementLiquidation =
        await marginEngine.callStatic.getPositionMarginRequirement(
          position.owner,
          position.tickLower,
          position.tickUpper,
          true,
          {
            blockTag: b,
          }
        );

      const positionInfo = await marginEngine.callStatic.getPosition(
        position.owner,
        position.tickLower,
        position.tickUpper,
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
        `${block.timestamp},${b},${tick},${ethers.utils.formatEther(
          positionInfo.margin
        )},${ethers.utils.formatEther(
          positionInfo._liquidity
        )},${ethers.utils.formatEther(
          positionInfo.variableTokenBalance
        )},${ethers.utils.formatEther(
          positionRequirementLiquidation
        )},${ethers.utils.formatEther(positionRequirementSafety)},${status}\n`
      );
    }
  });

module.exports = {};
