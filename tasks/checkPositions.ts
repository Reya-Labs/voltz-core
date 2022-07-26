import { task, types } from "hardhat/config";
import { MarginEngine } from "../typechain";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { getPositions, Position } from "../scripts/getPositions";

// rocket
// eslint-disable-next-line no-unused-vars
const rocketPoolRateOracle = "0x41EcaAC9061F6BABf2D42068F8F8dAF3BA9644FF";
// eslint-disable-next-line no-unused-vars
const rocketMarginEngine = "0xb1125ba5878cf3a843be686c6c2486306f03e301";

// lido
// eslint-disable-next-line no-unused-vars
const lidoRateOracle = "0xA667502bF7f5dA45c7b6a70dA7f0595E6Cf342D8";
// eslint-disable-next-line no-unused-vars
const lidoMarginEngine = "0x21f9151d6e06f834751b614c2ff40fc28811b235";

task("checkPositionsHealth", "Check positions")
  .addParam(
    "marginEngineAddress",
    "Queried Margin Engine",
    "0x0000000000000000000000000000000000000000",
    types.string
  )
  .setAction(async (taskArgs, hre) => {
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      taskArgs.marginEngineAddress
    )) as MarginEngine;

    const fs = require("fs");
    const file = `${taskArgs.marginEngineAddress}.csv`;

    const header =
      "owner,lower_tick,upper_tick,position_margin,position_liquidity,position_notional,position_requirement_liquidation,position_requirement_safety,status";

    fs.appendFileSync(file, header + "\n");
    console.log(header);

    const positions: Position[] = await getPositions();
    for (const position of positions) {
      if (position.marginEngine === taskArgs.marginEngineAddress) {
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

        console.log(
          position.owner,
          position.tickLower,
          position.tickUpper,
          ethers.utils.formatEther(positionInfo.margin),
          ethers.utils.formatEther(positionInfo._liquidity),
          ethers.utils.formatEther(positionInfo.variableTokenBalance),
          ethers.utils.formatEther(positionRequirementLiquidation),
          ethers.utils.formatEther(positionRequirementSafety),
          status
        );
        fs.appendFileSync(
          file,
          `${position.owner},${position.tickLower},${
            position.tickUpper
          },${ethers.utils.formatEther(
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
    }
  });

module.exports = {};
