import { task, types } from "hardhat/config";
import { BaseRateOracle, IVAMM, MarginEngine } from "../typechain";
import { BigNumber, ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { toBn } from "../test/helpers/toBn";
import { MAX_SQRT_RATIO, MIN_SQRT_RATIO } from "../test/shared/utilities";
import { decodeInfoPostSwap } from "./errorHandling";
import { marginEngineMasterTestFixture } from "../test/shared/fixtures";

const blocksPerDay = 6570; // 13.15 seconds per block

task("getHistoricalPositionHealth", "Check the history of a position")
  .addParam(
    "position",
    "A position ID from the subgraph <marginEngineAddress>#<owner>#<tickLower>#{tickUpper>"
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
  .setAction(async (taskArgs, hre) => {
    const [marginEngineAddress, owner, tickLower, tickUpper] =
      taskArgs.position.split("#");
    await hre.run("getHistoricalPositionsHealth", {
      marginEngineAddress,
      owner,
      tickLower,
      tickUpper,
      fromBlock: taskArgs.fromBlock,
      blockInterval: taskArgs.blockInterval,
    });
  });

task("getHistoricalPositionsHealth", "Check the history of a position")
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
    const file = `${taskArgs.marginEngineAddress}#${taskArgs.owner}#${taskArgs.tickLower}#${taskArgs.tickUpper}.csv`;

    const header =
      "block,timestamp,time,tick,sqrtPriceX96,variable_factor,historical_apy,position_margin,position_liquidity,fixed_token_balance,variable_token_balance,position_requirement_liquidation,position_requirement_safety,status";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    const rateOracleAddress = await marginEngine.rateOracle();
    let rateOracle = await hre.ethers.getContractAt(
      "BaseRateOracle",
      rateOracleAddress
    );
    const termStartTimestampWad = await marginEngine.termStartTimestampWad();
    const termEndTimestampWad = await marginEngine.termEndTimestampWad();

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const block = await hre.ethers.provider.getBlock(b);
      const blockTag = {
        blockTag: b,
      };

      const blockRateOracle = await marginEngine.rateOracle(blockTag);
      if (blockRateOracle !== rateOracleAddress) {
        rateOracle = (await hre.ethers.getContractAt(
          "BaseRateOracle",
          blockRateOracle
        )) as BaseRateOracle;
      }
      const variableFactor = await rateOracle.callStatic.variableFactor(
        termStartTimestampWad,
        termEndTimestampWad,
        blockTag
      );
      const historicalApy = await marginEngine.callStatic.getHistoricalApy(
        blockTag
      );

      const positionRequirementSafety =
        await marginEngine.callStatic.getPositionMarginRequirement(
          taskArgs.owner,
          taskArgs.tickLower,
          taskArgs.tickUpper,
          false,
          blockTag
        );

      const positionRequirementLiquidation =
        await marginEngine.callStatic.getPositionMarginRequirement(
          taskArgs.owner,
          taskArgs.tickLower,
          taskArgs.tickUpper,
          true,
          blockTag
        );

      const positionInfo = await marginEngine.callStatic.getPosition(
        taskArgs.owner,
        taskArgs.tickLower,
        taskArgs.tickUpper,
        blockTag
      );

      let status = "HEALTHY";
      if (positionInfo.margin.lte(positionRequirementLiquidation)) {
        status = "DANGER";
      } else if (positionInfo.margin.lte(positionRequirementSafety)) {
        status = "WARNING";
      }

      const vammVars = await vamm.vammVars({ blockTag: b });
      const tick = vammVars.tick;
      const sqrtPriceX96 = vammVars.sqrtPriceX96;

      const timeString = new Date(block.timestamp * 1000).toISOString();

      const wadValues = [
        variableFactor,
        historicalApy,
        positionInfo.margin,
        positionInfo._liquidity,
        positionInfo.fixedTokenBalance,
        positionInfo.variableTokenBalance,
        positionRequirementLiquidation,
        positionRequirementSafety,
      ].map((e) => ethers.utils.formatUnits(e));

      const outputLine = [
        b,
        block.timestamp,
        timeString,
        tick,
        sqrtPriceX96,
        ...wadValues,
        status,
      ]
        .map((e) => e.toString())
        .join(",");
      console.log(outputLine);

      fs.appendFileSync(file, `${outputLine}\n`);
    }
  });

module.exports = {};
