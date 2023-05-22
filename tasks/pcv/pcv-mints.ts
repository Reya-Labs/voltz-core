import { task } from "hardhat/config";
import { MarginEngine, Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";

import { getPool } from "../../poolConfigs/pool-addresses/pools";
import { mints, mintAdjustments } from "./mints";
import { getConfig } from "../../deployConfig/config";
import { getPositionInfo, tickAtFixedRate } from "../utils/helpers";

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
  await writeToMultisigTemplate(
    data,
    "../templates/pcv-mints.json.mustache",
    "pcv-mints"
  );
});

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
  };

  for (const mintAdjustment of mintAdjustments) {
    const pool = getPool(network, mintAdjustment.pool);

    // Fetch margin engine
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      pool.marginEngine
    )) as MarginEngine;

    // Process parameters
    const tickLower = tickAtFixedRate(mintAdjustment.fixedRateUpper);
    const tickUpper = tickAtFixedRate(mintAdjustment.fixedRateLower);

    // Compute current liquidity notional
    const { liquidity } = await getPositionInfo(
      marginEngine,
      {
        owner: multisig,
        tickLower,
        tickUpper,
      },
      pool.decimals
    );

    // Process notional to be minted or burned
    const notionalDelta = Math.round(
      mintAdjustment.newNotional - Math.round(liquidity)
    );
    if (notionalDelta < 0) {
      throw new Error(
        "Current script does not support negative delta adjustments."
      );
    }

    const notional = hre.ethers.utils
      .parseUnits(notionalDelta.toString(), pool.decimals)
      .toString();

    // Add mint to data keeper
    data.mints.push({
      marginEngine: pool.marginEngine,
      token: "", // not used
      tickLower: tickLower,
      tickUpper: tickUpper,
      notional: notional,
      marginDelta: "0", // not used
      last: false,
    });
  }

  if (data.mints.length === 0) {
    console.warn("No mints.");
    return;
  }

  data.mints[data.mints.length - 1].last = true;

  // Generate tx json
  await writeToMultisigTemplate(
    data,
    "../templates/pcv-mint-adjustments.json.mustache",
    "pcv-mint-adjustments"
  );
});

module.exports = {};
