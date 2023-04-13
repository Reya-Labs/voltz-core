import { task } from "hardhat/config";
import path from "path";
import mustache from "mustache";

import { getPool } from "../../poolConfigs/pool-addresses/pools";
import { inits } from "./inits";
import { getConfig } from "../../deployConfig/config";
import { sqrtPriceX96AtFixedRate } from "../utils/helpers";

type MultisigTemplate = {
  multisig: string;
  chainId: string;

  inits: {
    vamm: string;
    sqrtPriceX96: string;
    last: boolean;
  }[];
};

async function writeToMultisigTemplate(data: MultisigTemplate) {
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "../templates/init-vamms.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/${data.chainId}-init-vamms.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates multisig transactions for VAMM initialisation
//
// Example:
//   ``npx hardhat init-vamms --network mainnet``

task("init-vamms", "Initialises VAMMs").setAction(async (_, hre) => {
  // Retrieve multisig address for the current network
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;

  // Initialize the data keeper
  const data: MultisigTemplate = {
    multisig,
    chainId: await hre.getChainId(),

    inits: [],
  };

  for (const init of inits) {
    const pool = getPool(network, init.pool);

    // Process parameters
    const sqrtPriceX96 = sqrtPriceX96AtFixedRate(init.initialFixedRate);

    // Add mint to data keeper
    data.inits.push({
      vamm: pool.vamm,
      sqrtPriceX96: sqrtPriceX96.toString(),
      last: false,
    });
  }

  if (data.inits.length === 0) {
    console.warn("No initialisations.");
    return;
  }

  data.inits[data.inits.length - 1].last = true;

  // Generate tx json
  await writeToMultisigTemplate(data);
});

module.exports = {};
