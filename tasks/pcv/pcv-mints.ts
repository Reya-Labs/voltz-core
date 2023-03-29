import { task } from "hardhat/config";
import { MarginEngine, Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";

import { getPool } from "../../poolConfigs/pool-addresses/pools";
import { mints } from "./mints";
import { getConfig } from "../../deployConfig/config";
import { tickAtFixedRate } from "../utils/helpers";

type MultisigTemplate = {
  periphery: string;
  multisig: string;
  chainId: string;

  mints: {
    marginEngine: string;
    token: string;
    tickLower: number;
    tickUpper: number;
    notional: string;
    marginDelta: string;
    last: boolean;
  }[];
};

async function writeToMultisigTemplate(data: MultisigTemplate) {
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "../templates/pcv-mints.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/pcv-mints.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates multisig transactions for mints
//
// Example:
//   ``npx hardhat pcv-mints --network mainnet``

task("pcv-mints", "Mints liquidity").setAction(async (_, hre) => {
  // Fetch periphery
  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

  // Retrieve multisig address for the current network
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;

  // Initialize the data keeper
  const data: MultisigTemplate = {
    periphery: periphery.address,
    multisig,
    chainId: await hre.getChainId(),

    mints: [],
  };

  for (const mint of mints) {
    const pool = getPool(network, mint.pool);

    // Fetch margin engine
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      pool.marginEngine
    )) as MarginEngine;

    // Retrieve token address
    const tokenAddress = await marginEngine.underlyingToken();

    // Process parameters
    const tickLower = tickAtFixedRate(mint.fixedRateUpper);
    const tickUpper = tickAtFixedRate(mint.fixedRateLower);
    const notional = hre.ethers.utils
      .parseUnits((mint.marginDelta * mint.leverage).toString(), pool.decimals)
      .toString();
    const marginDelta = hre.ethers.utils
      .parseUnits(mint.marginDelta.toString(), pool.decimals)
      .toString();

    // Add mint to data keeper
    data.mints.push({
      marginEngine: pool.marginEngine,
      token: tokenAddress,
      tickLower: tickLower,
      tickUpper: tickUpper,
      notional: notional,
      marginDelta: marginDelta,
      last: false,
    });
  }

  if (data.mints.length === 0) {
    console.warn("No mints.");
    return;
  }

  data.mints[data.mints.length - 1].last = true;

  // Generate tx json
  await writeToMultisigTemplate(data);
});

module.exports = {};
