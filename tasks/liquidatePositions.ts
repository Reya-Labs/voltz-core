import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";
import { ethers } from "ethers";
import mustache from "mustache";
import path from "path";

import { getPositions, Position } from "../scripts/getPositions";
import * as poolAddresses from "../pool-addresses/mainnet.json";

interface liquidationTemplateData {
  liquidatablePositions: {
    marginEngineAddress: string;
    owner: string;
    tickLower: number;
    tickUpper: number;
  }[];
}

async function writeLiquidationOfPositionsToGnosisSafeTemplate(
  data: liquidationTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "liquidatePositions.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/liquidatePositions.json`;
  fs.writeFileSync(file, output);
}

task("liquidatePositions", "Liquidate liquidatable positions")
  .addFlag(
    "multisig",
    "If set, the task will output a JSON file for use in a multisig, instead of sending transactions on chain"
  )
  .addParam("pools", "The name of the pool (e.g. 'aDAI_v2', 'stETH_v1', etc.)")
  .setAction(async (taskArgs, hre) => {
    const data: liquidationTemplateData = {
      liquidatablePositions: [],
    };

    const poolNames = taskArgs.pools.split(",");
    const marginEngineAddresses = poolNames.map((poolName: string) => {
      return poolAddresses[poolName as keyof typeof poolAddresses].marginEngine;
    });

    console.log("margin engine addresses:", marginEngineAddresses);

    const positions: Position[] = await getPositions(
      Math.floor(Date.now() / 1000)
    );

    const currentBlock = await hre.ethers.provider.getBlock("latest");

    for (const marginEngineAddress of marginEngineAddresses) {
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;

      const marginEngineEndTimestamp = Number(
        ethers.utils.formatEther(await marginEngine.termEndTimestampWad())
      );

      if (marginEngineEndTimestamp <= currentBlock.timestamp) {
        continue;
      }

      for (const position of positions) {
        if (
          position.marginEngine.toLowerCase() !==
          marginEngineAddress.toLowerCase()
        ) {
          continue;
        }

        const positionRequirementSafety =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            false
          );

        const positionRequirementLiquidation =
          await marginEngine.callStatic.getPositionMarginRequirement(
            position.owner,
            position.tickLower,
            position.tickUpper,
            true
          );

        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        let status = "HEALTHY";
        if (positionInfo.margin.lte(positionRequirementLiquidation)) {
          status = "DANGER";
        } else if (positionInfo.margin.lte(positionRequirementSafety)) {
          status = "WARNING";
        }

        if (
          status === "DANGER" &&
          positionRequirementLiquidation.gt(BigInt(0)) &&
          positionInfo.variableTokenBalance.abs().gt(BigInt(0))
        ) {
          data.liquidatablePositions.push({
            marginEngineAddress: marginEngineAddress,
            owner: position.owner,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
          });

          console.log(
            position.owner,
            position.tickLower,
            position.tickUpper,
            ethers.utils.formatEther(positionInfo.margin),
            ethers.utils.formatEther(positionRequirementLiquidation),
            ethers.utils.formatEther(positionRequirementSafety),
            status,
            marginEngineAddress
          );
        }
      }
    }

    if (taskArgs.multisig) {
      writeLiquidationOfPositionsToGnosisSafeTemplate(data);
    } else {
      for (const liquidatablePosition of data.liquidatablePositions) {
        const marginEngine = (await hre.ethers.getContractAt(
          "MarginEngine",
          liquidatablePosition.marginEngineAddress
        )) as MarginEngine;

        const tx = await marginEngine.liquidatePosition(
          liquidatablePosition.owner,
          liquidatablePosition.tickLower,
          liquidatablePosition.tickUpper,
          {
            gasLimit: 10000000,
          }
        );
        await tx.wait();
      }
    }
  });

module.exports = {};
