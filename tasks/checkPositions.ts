import { task, types } from "hardhat/config";
import { MarginEngine } from "../typechain";
import positionsJson from "../playground/positions-ALL.json";

task("checkPositions", "Checks positions for liquidation")
  .addParam(
    "marginEngineAddress",
    "Queried margine engine",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as MarginEngine;

    for (const key in positionsJson.positions) {
      const position = positionsJson.positions[key];

      if (position.marginEngine === taskArgs.marginEngineAddress) {
        const positionRequirement =
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

        if (positionInfo.margin.lt(positionRequirement)) {
          console.log("Position ", key, " is liquiditable");
        }
      }
    }
  });

module.exports = {};
