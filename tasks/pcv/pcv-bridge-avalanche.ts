import { task } from "hardhat/config";
import path from "path";
import mustache from "mustache";

import { getConfig } from "../../deployConfig/config";
import { ONE_DAY_IN_SECONDS } from "../utils/constants";

type MultisigTemplate = {
  fromMultisig: string;
  fromChainId: string;

  toMultisig: string;
  toChainId: string;

  token: string;

  bridgeZap: string;

  auxToken: string;
  minAmountToMint: string;
  liquidityDeadline: string;

  amountToBridge: string;
  minToReceive: string;
  receiveDeadline: string;
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

  const file = `./tasks/JSONs/${data.fromChainId}-${outputFileName}.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates multisig transactions for mints
//
// Example:
//   ``npx hardhat pcv-mints --network mainnet``

task("pcv-bridge-avalanche", "Mints liquidity").setAction(async (_, hre) => {
  // Retrieve multisig address for the current network
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;
  const { getChainId } = hre;
  const chainId = await getChainId();

  const currentTimestamp = (await hre.ethers.provider.getBlock("latest"))
    .timestamp;

  // Initialize the data keeper
  const data: MultisigTemplate = {
    fromMultisig: multisig,
    fromChainId: chainId,

    toMultisig: getConfig("avalanche").multisig,
    toChainId: "43114",

    token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",

    bridgeZap: "0x6571d6be3d8460CF5F7d6711Cd9961860029D85F",

    auxToken: "0x1B84765dE8B7566e4cEAF4D0fD3c5aF52D3DdE4F",
    minAmountToMint: "9980000",
    liquidityDeadline: (currentTimestamp + ONE_DAY_IN_SECONDS).toString(),

    amountToBridge: (10 * 10 ** 6).toString(),
    minToReceive: (8 * 10 ** 6).toString(),
    receiveDeadline: (currentTimestamp + ONE_DAY_IN_SECONDS).toString(),
  };

  // Generate tx json
  await writeToMultisigTemplate(
    data,
    "../templates/pcv-bridge-avalanche.json.mustache",
    "pcv-bridge-avalanche"
  );
});

module.exports = {};
