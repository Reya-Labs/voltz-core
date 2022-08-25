import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";
import { ethers } from "ethers";
import "@nomiclabs/hardhat-ethers";
import { getPositions, Position } from "../scripts/getPositions";
import * as poolAddresses from "../pool-addresses/mainnet.json";

task("checkPositionsHealth", "Check positions")
  .addParam("exportFolder", "Folder to export")
  .addParam(
    "pools",
    "Comma-separated pool names as in pool-addresses/mainnet.json"
  )
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    const poolNames = taskArgs.pools.split(",");

    const pools: {
      [name: string]: {
        index: number;
        file: string;
        decimals: number;
        marginEngine: MarginEngine;
      };
    } = {};
    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      const tmp = poolAddresses[p as keyof typeof poolAddresses];

      if (!tmp) {
        throw new Error(`Pool ${p} doesnt's exist.`);
      }

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        tmp.marginEngine
      )) as MarginEngine;

      pools[tmp.marginEngine.toLowerCase()] = {
        index: i,
        file: `position-status/${taskArgs.exportFolder}/${p}.csv`,
        decimals: tmp.decimals,
        marginEngine: marginEngine,
      };
    }

    const header =
      "margin_engine,owner,lower_tick,upper_tick,position_margin,position_liquidity,position_notional,position_requirement_liquidation,position_requirement_safety,status";

    for (let i = 0; i < poolNames.length; i++) {
      const p = poolNames[i];
      fs.writeFile(
        `position-status/${taskArgs.exportFolder}/${p}.csv`,
        header + "\n",
        () => {}
      );
    }
    console.log(header);

    let positions: Position[] = await getPositions();
    positions = positions.filter((p) =>
      Object.keys(pools).includes(p.marginEngine.toLowerCase())
    );
    positions.sort((a, b) => {
      const i_a =
        pools[a.marginEngine.toLowerCase() as keyof typeof pools].index;
      const i_b =
        pools[b.marginEngine.toLowerCase() as keyof typeof pools].index;

      if (i_a === i_b) {
        if (a.owner.toLowerCase() === b.owner.toLowerCase()) {
          if (a.tickLower === b.tickLower) {
            return a.tickUpper - b.tickUpper;
          } else {
            return a.tickLower - b.tickLower;
          }
        } else {
          return a.owner.toLowerCase() < b.owner.toLowerCase() ? -1 : 1;
        }
      } else {
        return i_a < i_b ? -1 : 1;
      }
    });

    console.log("# of positions:", positions.length);

    for (const position of positions) {
      const tmp =
        pools[position.marginEngine.toLowerCase() as keyof typeof pools];

      const marginEngine = tmp.marginEngine;
      const decimals = tmp.decimals;

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
        marginEngine.address,
        position.owner,
        position.tickLower,
        position.tickUpper,
        ethers.utils.formatUnits(positionInfo.margin, decimals),
        ethers.utils.formatUnits(positionInfo._liquidity, decimals),
        ethers.utils.formatUnits(positionInfo.variableTokenBalance, decimals),
        ethers.utils.formatUnits(positionRequirementLiquidation, decimals),
        ethers.utils.formatUnits(positionRequirementSafety, decimals),
        status
      );
      fs.appendFileSync(
        tmp.file,
        `${marginEngine.address},${position.owner},${position.tickLower},${
          position.tickUpper
        },${ethers.utils.formatUnits(
          positionInfo.margin,
          decimals
        )},${ethers.utils.formatUnits(
          positionInfo._liquidity,
          decimals
        )},${ethers.utils.formatUnits(
          positionInfo.variableTokenBalance,
          decimals
        )},${ethers.utils.formatUnits(
          positionRequirementLiquidation,
          decimals
        )},${ethers.utils.formatUnits(
          positionRequirementSafety,
          decimals
        )},${status}\n`
      );
    }
  });

module.exports = {};
