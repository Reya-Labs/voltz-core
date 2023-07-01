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
  const emergencyMarginEngineImpl =
    "0xbe74538cba79fc440f8809e01b36c97AFBda23Ce";

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

  // Set custom settlement amounts
  console.log("Setting custom settlement amounts...");

  const batches: {
    batch: {
      owner: string;
      tickLower: string;
      tickUpper: string;
      amount: string;
      last: boolean;
    }[];
  }[] = [];

  {
    const batchSize = 10;
    let total = 0;
    for (let i = 0; i < positions.length; i += batchSize) {
      const slice =
        i + batchSize < positions.length
          ? positions.slice(i, i + batchSize)
          : positions.slice(i);

      const batch = slice.map((p) => ({
        owner: p.owner,
        tickLower: p.tickLower.toString(),
        tickUpper: p.tickUpper.toString(),
        amount: p.amount,
        last: false,
      }));

      batch[batch.length - 1].last = true;
      batches.push({
        batch,
      });

      total += batch.length;
    }

    if (total !== positions.length) {
      throw new Error(
        `Custom settlements have not been pushed for all positions.`
      );
    }
  }

  const data: MultisigTemplateData = {
    multisig: deployConfig.multisig,
    chainId: await hre.getChainId(),
    glpMarginEngineAddress,
    emergencyMarginEngineImpl,
    wethAddress,
    protocolContribution: toBn(143).toString(),
    batches,
  };

  await writeUpdateTransactionsToGnosisSafeTemplate(data);
});

module.exports = {};
