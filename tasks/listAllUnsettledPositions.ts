/* eslint-disable no-unneeded-ternary */
import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../scripts/getProtocolSubgraphURL";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";
import { MarginEngine } from "../typechain";
import { utils } from "ethers";
import { DateTime } from "luxon";

task("listAllUnsettledPositions", "Test glp upgrade")
  .addOptionalParam("underlyingNetwork", "The underlying network of the fork")
  .setAction(async (taskArgs, hre) => {
    const network: string = taskArgs.underlyingNetwork || hre.network.name;

    // Retrieve all matured positions
    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    const positions = (
      await getPositions(
        getProtocolSubgraphURL(hre.network.name),
        currentTimeInMS,
        {
          settled: false,
        }
      )
    ).filter((p) => p.amm.termEndTimestampInMS <= currentTimeInMS);

    // Create a folder for the output data
    const EXPORT_FOLDER = `position-status/data/${network}`;
    const fs = require("fs");
    if (!fs.existsSync(EXPORT_FOLDER)) {
      fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
    }
    const EXPORT_FILE = `${EXPORT_FOLDER}/unsettled-positions.csv`;
    const header =
      "Pool Name,Maturity,Margin Engine,VAMM,Owner,Tick Lower,Tick Upper";
    fs.writeFileSync(EXPORT_FILE, header + "\n", () => {});

    const poolDetails = getNetworkPools(hre.network.name);
    for (const poolName in poolDetails) {
      const pool = poolDetails[poolName];
      const ammPositions = positions.filter(
        (p) => p.amm.id.toLowerCase() === pool.vamm.toLowerCase()
      );

      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        pool.marginEngine
      )) as MarginEngine;

      const maturityTimestamp = Number(
        utils.formatEther(await marginEngine.termEndTimestampWad())
      );
      const maturityFormatted = DateTime.fromMillis(maturityTimestamp * 1000)
        .setLocale("en-gb")
        .toLocaleString(DateTime.DATE_MED);

      for (const position of ammPositions) {
        fs.appendFileSync(
          EXPORT_FILE,
          `${poolName},${maturityFormatted},${pool.marginEngine},${pool.vamm},${position.owner},${position.tickLower},${position.tickUpper}\n`
        );
      }
    }
  });
