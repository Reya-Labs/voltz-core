import { task } from "hardhat/config";
import { Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../../scripts/getProtocolSubgraphURL";
import { getConfig } from "../../deployConfig/config";

type MultisigTemplate = {
  periphery: string;
  multisig: string;
  chainId: string;

  positions: {
    marginEngine: string;
    owner: string;
    tickLower: number;
    tickUpper: number;
    last: boolean;
  }[];
};

async function writeToMultisigTemplate(data: MultisigTemplate) {
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "../templates/pcv-settlePositions.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/${data.chainId}-pcv-settlePositions.json`;
  fs.writeFileSync(file, output);
}

// Description:
//   This task generates multisig transactions to settle all matured positions
//
// Example:
//   ``npx hardhat pcv-settlePositions --network mainnet``

task(
  "pcv-settlePositions",
  "It settles all matured positions of multisig"
).setAction(async (taskArgs, hre) => {
  // Fetch periphery
  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

  // Retrieve multisig address for the current network
  const network = hre.network.name;
  const deployConfig = getConfig(network);
  const multisig = deployConfig.multisig;

  // Retrieve all matured positions
  const currentTimeInMS =
    (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

  const positions = await getPositions(
    getProtocolSubgraphURL(hre.network.name),
    currentTimeInMS,
    {
      owners: [multisig],
      settled: false,
      active: false,
    }
  );

  if (positions.length === 0) {
    console.warn("No matured positions.");
    return;
  }

  // Initialize the data keeper
  const data: MultisigTemplate = {
    periphery: periphery.address,
    multisig,
    chainId: await hre.getChainId(),
    positions: [],
  };

  for (const position of positions) {
    data.positions.push({
      marginEngine: position.amm.marginEngineId,
      owner: position.owner,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      last: false,
    });
  }

  data.positions[data.positions.length - 1].last = true;

  await writeToMultisigTemplate(data);
});

module.exports = {};
