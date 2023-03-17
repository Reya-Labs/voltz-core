import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getConfig } from "../deployConfig/config";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";

interface MultisigTemplateData {
  pauses: {
    vammAddress: string;
    pausabilityState: boolean;
    last: boolean; // Used to stop adding commas in JSON template
  }[];
  multisig: string;
  chainId: string;
}

function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "templates/setPausability.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `tasks/JSONs/setPausability.json`;
  fs.writeFileSync(file, output);
}

task("setPausability", "Set pausability state")
  .addVariadicPositionalParam("pools", "Comma-separated pool names")
  .setAction(async (taskArgs, hre) => {
    // Fetch pool details
    const poolNames: string[] = taskArgs.pools;
    const poolDetails = getNetworkPools(hre.network.name);

    // Check if queried pools are in the config
    for (const pool of poolNames) {
      if (!Object.keys(poolDetails).includes(pool)) {
        throw new Error(`Pool ${pool} is not present in the pools.`);
      }
    }

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Initialize the data keeper
    const data: MultisigTemplateData = {
      pauses: [],
      multisig,
      chainId: await hre.getChainId(),
    };

    // Iterate through the given pools and add them to the keeper
    for (const poolName of poolNames) {
      const pool = poolDetails[poolName];

      const pause = {
        vammAddress: pool.vamm,
        pausabilityState: true,
        last: false,
      };

      data.pauses.push(pause);
    }

    // Generate the tx json
    if (data.pauses.length > 0) {
      data.pauses[data.pauses.length - 1].last = true;

      writeUpdateTransactionsToGnosisSafeTemplate(data);
    } else {
      console.warn("No entries.");
    }
  });
