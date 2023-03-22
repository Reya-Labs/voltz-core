import { task } from "hardhat/config";
import { MarginEngine } from "../typechain";
import mustache from "mustache";
import path from "path";

import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../scripts/getProtocolSubgraphURL";
import { getPositionInfo, getPositionRequirements } from "./utils/helpers";
import { abs } from "mathjs";
import { getConfig } from "../deployConfig/config";

const Confirm = require("prompt-confirm");

interface liquidationTemplateData {
  liquidatablePositions: {
    marginEngineAddress: string;
    owner: string;
    tickLower: number;
    tickUpper: number;
    last: boolean; // Used to stop adding commas in JSON template
  }[];
  multisig: string;
  chainId: string;
}

// Description:
//   This task generates a tx json for multisig to liquidate all liquidatable positions of a give pool
//   if the --multisig flag is set. Otherwise, it executes the liquidations.
//
// Example:
//   ``npx hardhat liquidatePositions --network mainnet aUSDC_v11 --multisig``

async function writeLiquidationOfPositionsToGnosisSafeTemplate(
  data: liquidationTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "templates/liquidatePositions.json.mustache"),
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
  .addOptionalParam(
    "networkName",
    "Name of underlying network when using forks"
  )
  .addOptionalParam("owners", "Filter by list of owners")
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .setAction(async (taskArgs, hre) => {
    const network = taskArgs.networkName || hre.network.name;

    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;
    const poolDetails = getNetworkPools(network);

    // Check if queried pools are in the config
    for (const pool of poolNames) {
      if (!Object.keys(poolDetails).includes(pool)) {
        throw new Error(`Pool ${pool} is not present in the pools.`);
      }
    }

    // Fetch current time
    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentTimeInMS = currentBlock.timestamp * 1000;

    // Retrieve all positions from subgraph
    let positions = await getPositions(
      getProtocolSubgraphURL(network),
      currentTimeInMS,
      {
        ammIDs: poolNames.map((pool) => poolDetails[pool].vamm),
      }
    );

    if (taskArgs.owners) {
      const filter_owners = taskArgs.owners
        .split(",")
        .map((p: string) => p.toLowerCase());

      positions = positions.filter((p) =>
        filter_owners.includes(p.owner.toLowerCase())
      );
    }

    // Get deployer address
    const { deployer } = await hre.getNamedAccounts();

    // Retrieve multisig address for the current network
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Initialize the data keeper
    const data: liquidationTemplateData = {
      liquidatablePositions: [],
      multisig,
      chainId: await hre.getChainId(),
    };

    for (const poolName of poolNames) {
      // Retrieve pool details
      const pool = poolDetails[poolName];

      // Fetch margin engine
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        pool.marginEngine
      )) as MarginEngine;

      // Retrieve margin engine end timestamps in seconds
      const marginEngineEndTimestamp = Number(
        hre.ethers.utils.formatUnits(
          await marginEngine.termEndTimestampWad(),
          18
        )
      );

      // Check if the pool has matured
      if (marginEngineEndTimestamp <= currentBlock.timestamp) {
        console.warn(`Pool ${poolName} has matured. Skipping...`);
        continue;
      }

      // Filter the positions belonging to the current pool
      const mePositions = positions.filter(
        (p) =>
          p.amm.marginEngineId.toLowerCase() === pool.marginEngine.toLowerCase()
      );

      for (const position of mePositions) {
        // Get position information
        const positionInfo = await getPositionInfo(
          marginEngine,
          position,
          pool.decimals
        );

        // Get position margin requirements
        const { safetyThreshold, liquidationThreshold } =
          await getPositionRequirements(marginEngine, position, pool.decimals);

        // Get the health status
        let status = "HEALTHY";
        if (positionInfo.margin < liquidationThreshold) {
          status = "DANGER";
        } else if (positionInfo.margin < safetyThreshold) {
          status = "WARNING";
        }

        // If liquidatable, add it to the data keeper
        if (
          status === "DANGER" &&
          liquidationThreshold > 0 &&
          abs(positionInfo.variableTokenBalance) > 0
        ) {
          data.liquidatablePositions.push({
            marginEngineAddress: pool.marginEngine,
            owner: position.owner,
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            last: false,
          });

          console.log(
            position.owner,
            position.tickLower,
            position.tickUpper,
            positionInfo.margin,
            liquidationThreshold,
            safetyThreshold,
            status,
            pool.marginEngine
          );
        }
      }
    }

    if (data.liquidatablePositions.length === 0) {
      console.log("No liquidatable position.");
      return;
    }

    data.liquidatablePositions[data.liquidatablePositions.length - 1].last =
      true;

    if (taskArgs.multisig) {
      writeLiquidationOfPositionsToGnosisSafeTemplate(data);
    } else {
      const prompt = new Confirm(
        `Are you sure that you want to liquidate ${data.liquidatablePositions.length} positions from ${deployer} on ${network}?`
      );

      const response = await prompt.run();

      if (!response) {
        console.log("Rejected");
        return;
      }

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
