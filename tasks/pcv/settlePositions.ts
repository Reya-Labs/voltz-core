import { task } from "hardhat/config";
import { Periphery } from "../../typechain";
import path from "path";
import mustache from "mustache";
import { getPositions } from "@voltz-protocol/subgraph-data";
import { getProtocolSubgraphURL } from "../../scripts/getProtocolSubgraphURL";

type MultisigTemplate = {
  periphery: string;
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
    path.join(__dirname, "../templates/settlePositions.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `./tasks/JSONs/settlePositions.json`;
  fs.writeFileSync(file, output);
}

task("settlePositions", "It settles all matured positions")
  .addParam("owner", "The address of owner of positions")
  .setAction(async (taskArgs, hre) => {
    const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

    const currentTimeInMS =
      (await hre.ethers.provider.getBlock("latest")).timestamp * 1000;

    const positions = await getPositions(
      getProtocolSubgraphURL(hre.network.name),
      currentTimeInMS,
      {
        owners: [taskArgs.owner],
        settled: false,
        active: false,
      }
    );

    const data: MultisigTemplate = {
      periphery: periphery.address,
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
