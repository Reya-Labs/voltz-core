import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { getPositions, Position } from "../scripts/getPositions";
import { MarginEngine } from "../typechain/MarginEngine";

interface MultisigTemplateData {
  pools: {
    vammAddress: string;
    marginEngineAddress: string;
    isAlpha: boolean;
  }[];
}

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "setIsAlpha.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `setIsAlpha.json`;
  fs.writeFileSync(file, output);
}

task("setIsAlpha", "Set is alpha in margin engine and VAMM").setAction(
  async (taskArgs, hre) => {
    const marginEngineAddresses = new Set<string>();
    const positions: Position[] = await getPositions();
    for (const position of positions) {
      marginEngineAddresses.add(position.marginEngine);
    }

    const data: MultisigTemplateData = {
      pools: [],
    };

    for (const marginEngineAddress of marginEngineAddresses) {
      const marginEngine = (await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
      )) as MarginEngine;

      const vammAddress = await marginEngine.vamm();
      const pool = {
        vammAddress: vammAddress,
        marginEngineAddress: marginEngineAddress,
        isAlpha: false,
      };

      data.pools.push(pool);
    }

    await writeUpdateTransactionsToGnosisSafeTemplate(data);
  }
);
