import "@nomiclabs/hardhat-ethers";

import { task } from "hardhat/config";
import mustache from "mustache";
import path from "path";
import { IMarginEngine } from "../typechain";

const marginEngineAddresses = [
  "0x0BC09825Ce9433B2cDF60891e1B50a300b069Dd2",
  "0x21F9151d6e06f834751b614C2Ff40Fc28811B235",
  "0xF2CCD85A3428D7a560802B2DD99130bE62556D30",
  "0x654316A63E68f1c0823f0518570bc108de377831",
  "0xB1125ba5878cF3A843bE686c6c2486306f03E301",
];

interface MultisigTemplateData {
  pauses: {
    vammAddress: string;
    pausabilityState: boolean;
  }[];
}

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  // Get external template with fetch
  const fs = require("fs");
  const template = fs.readFileSync(
    path.join(__dirname, "templates/setPausability.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const file = `setPausability.json`;
  fs.writeFileSync(file, output);
}

task("setPausability", "Set pausability state").setAction(
  async (taskArgs, hre) => {
    const data: MultisigTemplateData = {
      pauses: [],
    };

    for (const marginEngineAddress of marginEngineAddresses) {
      const marginEngine = (await hre.ethers.getContractAt(
        "IMarginEngine",
        marginEngineAddress
      )) as IMarginEngine;

      const vammAddress = await marginEngine.vamm();

      const pause = {
        vammAddress: vammAddress,
        pausabilityState: true,
      };

      data.pauses.push(pause);
    }

    await writeUpdateTransactionsToGnosisSafeTemplate(data);
  }
);
