import mustache from "mustache";
import * as fs from "fs";
import path from "path";
import { task } from "hardhat/config";
import { getNetworkPools } from "../poolConfigs/pool-addresses/pools";
import { getConfig } from "../deployConfig/config";
import { getNetworkPausers } from "../poolConfigs/pausers/pausers";

interface MultisigTemplateData {
  multisig: string;
  chainId: string;
  voltzPausabilityWrapper: string;
  pausers: {
    pauser: string;
  }[];
  pools: {
    vamm: string;
  }[];
}

async function writeIrsCreationTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const template = fs.readFileSync(
    path.join(
      __dirname,
      "templates/initialisePausabilityWrapper.json.mustache"
    ),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "JSONs");
  const outFile = path.join(jsonDir, "initialisePausabilityWrapper.json");
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }
  fs.writeFileSync(outFile, output);

  console.log("Output written to ", outFile.toString());
}

// Description: Once a new pausability wrapper is deployed, this task generates
//   the corresponding txs to initialise it (i.e. add corresponding pausers and give it pauser permission to VAMMs)
//
// Example:
//   ``npx hardhat initialisePausabilityWrapper --network mainnet``

task(
  "initialisePausabilityWrapper",
  "Initialise pausability wrapper"
).setAction(async (_, hre) => {
  const poolDetails = getNetworkPools(hre.network.name);

  // Retrieve multisig address for the current network
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;

  const voltzPausabilityWrapper = await hre.ethers.getContract(
    "VoltzPausabilityWrapper"
  );

  const pausers = getNetworkPausers(network).map((p) => ({
    pauser: p,
  }));

  const pools = Object.keys(poolDetails).map((p) => ({
    vamm: poolDetails[p].vamm,
  }));

  const data: MultisigTemplateData = {
    multisig,
    voltzPausabilityWrapper: voltzPausabilityWrapper.address,
    chainId: await hre.getChainId(),
    pools,
    pausers,
  };

  writeIrsCreationTransactionsToGnosisSafeTemplate(data);
});
