import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";

import fs from "fs";
import csv from "csv-parser";
import path from "path";
import mustache from "mustache";
import { MarginEngine, IERC20Minimal } from "../typechain";

interface MultisigTemplateData {
  multisig: string;
  chainId: string;
  marginEngineAddress: string;
  marginEngineImpl: string;
  erc20Address: string;
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

const insolvencyCases = [
  {
    marginEngineAddress: "0x9b5b9d31c7b4a826cd30c09136a2fdea9c69efcd",
    marginEngineImpl: "0xB5Ed2c212a577Fda7c546B153c0337a8Bb3f2dCa",
    network: "arbitrum",
    inputAmountsFile: "arb_aaveV3_usdc_amounts",
    protocolContribution: 0,
    pcvToSettle: true,
  },
  {
    marginEngineAddress: "0x7dcd48966eb559dfa6db842ba312c96dce0cb0b2",
    marginEngineImpl: "0x6887711f4CAdEbA666CEFa62D8692101D3c5826F",
    network: "mainnet",
    inputAmountsFile: "eth_aaveV2_usdc_amounts",
    protocolContribution: 11510,
    pcvToSettle: true,
  },
  {
    marginEngineAddress: "0x19654a85a96da7b39aa605259ee1568e55ccb9ba",
    marginEngineImpl: "0x6887711f4CAdEbA666CEFa62D8692101D3c5826F",
    network: "mainnet",
    inputAmountsFile: "eth_aaveV3_usdc_amounts",
    protocolContribution: 101920,
    pcvToSettle: false,
  },
];

async function writeUpdateTransactionsToGnosisSafeTemplate(
  data: MultisigTemplateData,
  file: string
) {
  const fs = require("fs");

  const template = fs.readFileSync(
    path.join(__dirname, "templates/insolvencyRemediation.json.mustache"),
    "utf8"
  );
  const output = mustache.render(template, data);

  const jsonDir = path.join(__dirname, "JSONs");
  const outFile = path.join(jsonDir, `${file}.json`);

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
  "generateInsolvencyRemediationTxs",
  "It generates the transaction for remediation"
).setAction(async (_, hre) => {
  const {
    protocolContribution,
    marginEngineAddress,
    marginEngineImpl,
    network,
    inputAmountsFile,
  } = insolvencyCases[0];

  // only for the corresponding network
  if (!(hre.network.name === network)) {
    throw new Error(`Generating txs not available for ${hre.network.name}`);
  }

  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  const erc20Address = await marginEngine.underlyingToken();

  const erc20 = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    erc20Address
  )) as IERC20Minimal;

  const decimals = await erc20.decimals();

  const rawPositions = (await readCSVFile(
    `tasks/input-ds/${inputAmountsFile}.csv`
  )) as {
    owner: string;
    tickLower: number;
    tickUpper: number;
    takeHome: string;
  }[];

  const positions = rawPositions
    .map((p) => ({
      owner: p.owner,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      amount: hre.ethers.utils
        .parseUnits(Number(p.takeHome).toFixed(decimals), decimals)
        .toString(),
    }))
    .slice(0, 2000);

  // impersonate multisig wallet
  const deployConfig = getConfig(network);

  // Upgrade margin engine

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
    marginEngineAddress,
    marginEngineImpl,
    erc20Address,
    protocolContribution: hre.ethers.utils
      .parseUnits(protocolContribution.toFixed(decimals), decimals)
      .toString(),
    batches,
  };

  await writeUpdateTransactionsToGnosisSafeTemplate(data, inputAmountsFile);
});

module.exports = {};
