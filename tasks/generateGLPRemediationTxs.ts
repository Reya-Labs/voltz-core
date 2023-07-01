import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";

import fs from "fs";
import csv from "csv-parser";
import { toBn } from "../test/helpers/toBn";
import path from "path";
import mustache from "mustache";

interface MultisigTemplateData {
  multisig: string;
  chainId: string;
  glpMarginEngineAddress: string;
  emergencyMarginEngineImpl: string;
  wethAddress: string;
  protocolContribution: string;
  batches: {
    batch: {
      owner: string;
      tickLower: string;
      tickUpper: string;
      amount: string;
      last: boolean;
    }[];
  }[];
}

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData
) {
  const fs = require("fs");

  const template = fs.readFileSync(
    path.join(__dirname, "templates/glpRemediation.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "JSONs");
  const outFile = path.join(jsonDir, "glpRemediation.json");

  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir);
  }

  fs.writeFileSync(outFile, output);

  console.log("Output written to ", outFile.toString());
}

export async function readCSVFile(filePath: string): Promise<object[]> {
  const results: object[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

task(
  "generateGLPRemediationTxs",
  "It generates the transaction for GLP Remediation"
).setAction(async (_, hre) => {
  // only for arbitrum
  if (!(hre.network.name === "arbitrum")) {
    throw new Error(`Generating txs not available for ${hre.network.name}`);
  }

  const glpMarginEngineAddress = "0xbe958ba49be73d3020cb62e512619da953a2bab1";
  const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const emergencyMarginEngineImpl = "0x";

  const positions = (await readCSVFile("tasks/glp_amounts.csv")) as {
    owner: string;
    tickLower: number;
    tickUpper: number;
    amount: string;
  }[];

  // impersonate multisig wallet
  const network: string = "arbitrum";
  const deployConfig = getConfig(network);

  // Upgrade GLP margin engine
  const batch: MultisigTemplateData = {
    multisig: deployConfig.multisig,
    chainId: await hre.getChainId(),
    glpMarginEngineAddress,
    emergencyMarginEngineImpl,
    wethAddress,
    protocolContribution: toBn(143).toString(),
    batches: [
      {
        batch: [
          {
            owner: positions[0].owner,
            tickLower: positions[0].tickLower.toString(),
            tickUpper: positions[0].tickUpper.toString(),
            amount: positions[0].amount,
            last: true,
          },
        ],
      },
    ],
  };

  // Set custom settlement amounts
  console.log("Setting custom settlement amounts...");

  {
    const batchSize = 10;
    let total = 0;
    for (let i = 0; i < positions.length; i += batchSize) {
      const batch =
        i + batchSize < positions.length
          ? positions.slice(i, i + batchSize)
          : positions.slice(i);

      total += batch.length;
      // todo: append tx to set custom settlements to this batch
    }

    if (total !== positions.length) {
      throw new Error(
        `Custom settlements have not been pushed for all positions.`
      );
    }
  }

  await writeUpdateTransactionsToGnosisSafeTemplate(batch);
});

module.exports = {};
