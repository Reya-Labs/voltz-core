import { task } from "hardhat/config";
import { getConfig } from "../deployConfig/config";
import {
  Factory,
  IERC20Minimal,
  MarginEngine,
  Periphery,
  VAMM,
} from "../typechain";
import { getSigner } from "./utils/getSigner";

import fs from "fs";
import csv from "csv-parser";

const insolvencyCases = [
  {
    marginEngineAddress: "0x9b5b9d31c7b4a826cd30c09136a2fdea9c69efcd",
    vammAddress: "0x3ecf01157e9b1a66197325771b63789d1fb18f1f",
    network: "arbitrum",
    inputAmountsFile: "arb_aaveV3_usdc_amounts",
    protocolContribution: 0,
  },
  {
    marginEngineAddress: "0x7dcd48966eb559dfa6db842ba312c96dce0cb0b2",
    vammAddress: "0x037c8d42972c3c058224a2e51b5cb9b504f75b77",
    network: "mainnet",
    inputAmountsFile: "eth_aaveV2_usdc_amounts",
    protocolContribution: 9426,
  },
  {
    marginEngineAddress: "0x19654a85a96da7b39aa605259ee1568e55ccb9ba",
    vammAddress: "0xd9a3f015a4ffd645014ec0f43148685be8754737",
    network: "mainnet",
    inputAmountsFile: "eth_aaveV3_usdc_amounts",
    protocolContribution: 130460,
  },
];

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
  "simulateInsolvencyRemediation",
  "It simulates the new insolvency remediation scenarios"
).setAction(async (_, hre) => {
  // only for local networks
  if (!(hre.network.name === "localhost")) {
    throw new Error(`Simulation not available for ${hre.network.name}`);
  }

  const randomUserAddress = "0x4dBE8aeB06aB0771D8AEb02B100Feb6bF32fD899";
  const pauserAddress = "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700";
  const {
    marginEngineAddress,
    vammAddress,
    network,
    inputAmountsFile,
    protocolContribution,
  } = insolvencyCases[2];

  const rawPositions = (await readCSVFile(
    `tasks/input-ds/${inputAmountsFile}.csv`
  )) as {
    owner: string;
    tickLower: number;
    tickUpper: number;
    takeHome: string;
  }[];

  // impersonate multisig wallet
  const deployConfig = getConfig(network);
  const multisig = await getSigner(hre, deployConfig.multisig);

  // impresonate random wallet
  const randomUser = await getSigner(hre, randomUserAddress);

  // impersonate pauser
  const pauser = await getSigner(hre, pauserAddress);

  // fetch factory (make sure all deployments are copied to localhost)
  const factory = (await hre.ethers.getContract("Factory")) as Factory;

  // fetch periphery
  const periphery = (await hre.ethers.getContractAt(
    "Periphery",
    await factory.periphery()
  )) as Periphery;

  // Fetch Margin Engine
  console.log("Fetching ME...");
  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  // fetch erc20
  const erc20Address = await marginEngine.underlyingToken();

  const erc20 = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    erc20Address
  )) as IERC20Minimal;

  const decimals = await erc20.decimals();

  console.log("Fetching VAMM...");
  // Fetch VAMM
  const vamm = (await hre.ethers.getContractAt("VAMM", vammAddress)) as VAMM;

  console.log("Deploying implementation...");
  const marginEngineFactory = await hre.ethers.getContractFactory(
    "MarginEngine"
  );

  const emergencyMarginEngineImpl =
    (await marginEngineFactory.deploy()) as MarginEngine;

  console.log("impl.", emergencyMarginEngineImpl.address);

  // Upgrade margin engine
  console.log(`Upgrading ME (with owner ${await marginEngine.owner()})...`);
  await marginEngine
    .connect(multisig)
    .upgradeTo(emergencyMarginEngineImpl.address);

  // Set custom settlement amounts
  console.log("Setting custom settlement amounts...");

  const positions = rawPositions.map((p) => ({
    owner: p.owner,
    tickLower: p.tickLower,
    tickUpper: p.tickUpper,
    amount: hre.ethers.utils
      .parseUnits(Number(p.takeHome).toFixed(decimals), decimals)
      .toString(),
  }));

  try {
    await marginEngine
      .connect(randomUser)
      .setCustomSettlements(positions.slice(0, 1));
    throw new Error("Fatal");
  } catch (error) {
    console.log("Error thrown as expected");
    if ((error as Error).message === "Fatal") {
      throw error;
    }
  }

  {
    const batchSize = 10;
    let total = 0;
    for (let i = 0; i < positions.length; i += batchSize) {
      const batch =
        i + batchSize < positions.length
          ? positions.slice(i, i + batchSize)
          : positions.slice(i);

      await marginEngine.connect(multisig).setCustomSettlements(batch);
      total += batch.length;

      console.log(`Pushed custom settlements (${total}/${positions.length})`);
    }

    if (total !== positions.length) {
      throw new Error(
        `Custom settlements have not been pushed for all positions.`
      );
    }
  }

  // Send protocol contribution
  await erc20
    .connect(multisig)
    .transfer(
      marginEngineAddress,
      hre.ethers.utils
        .parseUnits(protocolContribution.toFixed(decimals), decimals)
        .toString()
    );

  {
    const balance = await erc20.balanceOf(marginEngineAddress);
    console.log(
      "initial balance of ME:",
      hre.ethers.utils.formatUnits(balance, decimals)
    );
  }

  // Unpause contract
  await vamm.connect(pauser).setPausability(false);

  // Users withdraw
  console.log("Settling positions...");

  const header = "owner,tickLower,tickUpper,amount";
  fs.writeFile(
    `tasks/output/${inputAmountsFile}_output.csv`,
    header + "\n",
    () => {}
  );

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (i % 10 === 0) {
      console.log(`Settled ${i} out of ${positions.length} positions.`);
    }

    const wallet = await getSigner(hre, p.owner);

    const walletA = await erc20.balanceOf(p.owner);

    try {
      await periphery
        .connect(wallet)
        .settlePositionAndWithdrawMargin(
          marginEngineAddress,
          p.owner,
          p.tickLower,
          p.tickUpper
        );
    } catch (error) {
      if (p.amount !== "0") {
        console.log("No enough funds to settle");
      }
    }

    const walletB = await erc20.balanceOf(p.owner);

    const row = `${p.owner},${p.tickLower},${
      p.tickUpper
    },${hre.ethers.utils.formatUnits(walletB.sub(walletA), decimals)}`;
    fs.appendFileSync(
      `tasks/output/${inputAmountsFile}_output.csv`,
      row + "\n"
    );
  }

  // Check margin engine balance and users' wallets
  console.log("Checking balances...");
  {
    const balance = await erc20.balanceOf(marginEngineAddress);
    console.log(
      "final balance of ME:",
      hre.ethers.utils.formatUnits(balance, decimals)
    );
  }

  console.log(
    `Done all simulations (ME with owner ${await marginEngine.owner()}).`
  );
});

module.exports = {};
