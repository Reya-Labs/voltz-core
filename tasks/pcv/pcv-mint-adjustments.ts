import { task } from "hardhat/config";
import { Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";

import { getPool } from "../../poolConfigs/pool-addresses/pools";
import { mintAdjustments } from "./mint-adjustments";
import { getConfig } from "../../deployConfig/config";
import { tickAtFixedRate } from "../utils/helpers";

type MultisigTemplate = {
  periphery: string;
  multisig: string;
  chainId: string;

  mints: {
    marginEngine: string;
    tickLower: number;
    tickUpper: number;
    isMint: boolean;
    notionalDelta: string;
    marginDelta: string;
    last: boolean;
  }[];

  marginUpdates: {
    marginEngine: string;
    tickLower: number;
    tickUpper: number;
    marginDelta: string;
    last: boolean;
  }[];
};

async function writeToMultisigTemplate(
  data: MultisigTemplate,
  templateRelativePath: string,
  outputFileName: string
) {
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, templateRelativePath),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/${data.chainId}-${outputFileName}.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates multisig transactions for mint adjustments
//
// Example:
//   ``npx hardhat pcv-mint-adjustments --network mainnet``

task(
  "pcv-mint-adjustments",
  "Adjusts the notional of pcv-minted liquidity"
).setAction(async (_, hre) => {
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
    marginUpdates: [],
  };

  for (const mintAdjustment of mintAdjustments) {
    const pool = getPool(network, mintAdjustment.pool);

    // Process parameters
    const tickLower = tickAtFixedRate(mintAdjustment.fixedRateUpper);
    const tickUpper = tickAtFixedRate(mintAdjustment.fixedRateLower);

    // Process notional to be minted or burned
    const notionalScaled = hre.ethers.utils
      .parseUnits(
        Math.abs(mintAdjustment.notionalDelta).toString(),
        pool.decimals
      )
      .toString();

    // Process margin to be added or removed
    const marginDeltaScaled = hre.ethers.utils
      .parseUnits(mintAdjustment.marginDelta.toString(), pool.decimals)
      .toString();

    if (mintAdjustment.notionalDelta === 0) {
      data.marginUpdates.push({
        marginEngine: pool.marginEngine,
        tickLower: tickLower,
        tickUpper: tickUpper,
        marginDelta: marginDeltaScaled,
        last: false,
      });
    } else {
      data.mints.push({
        marginEngine: pool.marginEngine,
        tickLower: tickLower,
        tickUpper: tickUpper,
        isMint: mintAdjustment.notionalDelta > 0,
        notionalDelta: notionalScaled,
        marginDelta: marginDeltaScaled,
        last: false,
      });
    }
  }

  if (data.mints.length + data.marginUpdates.length === 0) {
    console.warn("No mints or margin updates.");
    return;
  }

  if (data.marginUpdates.length > 0) {
    data.marginUpdates[data.marginUpdates.length - 1].last = true;
  } else {
    data.mints[data.mints.length - 1].last = true;
  }

  // Generate tx json
  await writeToMultisigTemplate(
    data,
    "../templates/pcv-mint-adjustments.json.mustache",
    "pcv-mint-adjustments"
  );
});

module.exports = {};
