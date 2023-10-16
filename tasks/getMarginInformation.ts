import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";
import { ethers } from "ethers";

import { getPositions, Position } from "../scripts/getPositions";
import { getPool } from "../poolConfigs/pool-addresses/pools";
import { PositionHistory } from "../scripts/getPositionHistory";

task(
  "getMarginInformation",
  "Retrieves information about positions' margin account"
)
  .addOptionalParam("owners", "Filter by list of owners")
  .addOptionalParam("tickLowers", "Filter by tick lowers")
  .addOptionalParam("tickUppers", "Filter by tick uppers")
  .addOptionalParam(
    "networkName",
    "Name of underlying network when using forks"
  )
  .addVariadicPositionalParam("pools", "Space-separated pool names")
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;

    let networkName = hre.network.name;
    if (taskArgs.networkName) {
      if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        throw new Error(`Cannot redefine name for network ${hre.network.name}`);
      }

      networkName = taskArgs.networkName;
    }

    // Create a folder for the output data
    const EXPORT_FOLDER = `position-status/data/${networkName}`;
    const fs = require("fs");
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }

    const EXPORT_FILE = `${EXPORT_FOLDER}/margin-information.csv`;

    const header =
      "Pool,Margin Engine,Owner,Lower Tick,Upper Tick,Settled,Current Margin,Margin In,Margin Out,Net Margin In&Out,LP&Protocol Fees Paid,Accumulated LP Fees,Liquidator Rewards Paid";
    fs.writeFile(EXPORT_FILE, header + "\n", () => {});

    let positions: Position[] = await getPositions(networkName, undefined);

    if (taskArgs.owners) {
      const filter_owners = taskArgs.owners
        .split(",")
        .map((p: string) => p.toLowerCase());

      positions = positions.filter((p) =>
        filter_owners.includes(p.owner.toLowerCase())
      );
    }

    if (taskArgs.tickLowers) {
      const filter_tickLowers = taskArgs.tickLowers.split(",");

      positions = positions.filter((p) =>
        filter_tickLowers.includes(p.tickLower.toString())
      );
    }

    if (taskArgs.tickUppers) {
      const filter_tickUppers = taskArgs.tickUppers.split(",");

      positions = positions.filter((p) =>
        filter_tickUppers.includes(p.tickUpper.toString())
      );
    }

    for (const pool of poolNames) {
      console.log(`Processing pool ${pool}`);

      const poolDetails = getPool(hre.network.name, pool);

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        poolDetails.marginEngine
      )) as MarginEngine;

      const pool_positions = positions.filter(
        (p) => p.marginEngine === poolDetails.marginEngine.toLowerCase()
      );

      for (const position of pool_positions) {
        const positionInfo = await marginEngine.callStatic.getPosition(
          position.owner,
          position.tickLower,
          position.tickUpper
        );

        const positionHistory = new PositionHistory(
          `${poolDetails.marginEngine.toLowerCase()}#${position.owner.toLowerCase()}#${
            position.tickLower
          }#${position.tickUpper}`,
          position.tickLower,
          position.tickUpper,
          poolDetails.decimals
        );
        await positionHistory.getInfo(hre.network.name);

        let marginIn = 0;
        let marginOut = 0;
        for (const item of positionHistory.marginUpdates) {
          if (item.marginDelta > 0) {
            marginIn += item.marginDelta;
          } else {
            marginOut -= item.marginDelta;
          }
        }

        let lpAndProtocolFees = 0;
        for (const item of positionHistory.swaps) {
          lpAndProtocolFees += item.fees;
        }

        let liquidatorRewardsPaid = 0;
        for (const item of positionHistory.liquidations) {
          liquidatorRewardsPaid += item.reward;
        }

        fs.appendFileSync(
          EXPORT_FILE,
          `${pool},${poolDetails.marginEngine},${position.owner},${
            position.tickLower
          },${position.tickUpper},${
            positionInfo.isSettled
          },${ethers.utils.formatUnits(
            positionInfo.margin,
            poolDetails.decimals
          )},${marginIn},${marginOut},${
            marginIn - marginOut
          },${lpAndProtocolFees},${ethers.utils.formatUnits(
            positionInfo.accumulatedFees,
            poolDetails.decimals
          )},${liquidatorRewardsPaid}\n`
        );
      }
    }
  });

module.exports = {};
