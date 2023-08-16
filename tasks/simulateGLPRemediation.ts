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
import { toBn } from "../test/helpers/toBn";

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
  "simulateGLPRemediation",
  "It simulates the GLP remediation scenario"
).setAction(async (_, hre) => {
  // only for local networks
  if (!(hre.network.name === "localhost")) {
    throw new Error(`Simulation not available for ${hre.network.name}`);
  }

  const glpMarginEngineAddress = "0xbe958ba49be73d3020cb62e512619da953a2bab1";
  const glpVammAddress = "0x22393f23f16925d282aeca0a8464dccaf10ee480";
  const randomUserAddress = "0x4dBE8aeB06aB0771D8AEb02B100Feb6bF32fD899";
  const pauserAddress = "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700";
  const wethAddress = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

  // const positions: {
  //   owner: string;
  //   tickLower: number;
  //   tickUpper: number;
  //   amount: string;
  // }[] = [
  //   {
  //     owner: "0x005ae102dd1ab7b2c56276ebbe32e6db43143f81",
  //     tickLower: -69060,
  //     tickUpper: 0,
  //     amount: "1000000000000000000",
  //   },
  // ];

  const positions = (await readCSVFile("tasks/glp_amounts.csv")) as {
    owner: string;
    tickLower: number;
    tickUpper: number;
    amount: string;
  }[];

  // impersonate multisig wallet
  const network: string = "arbitrum";
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

  // fetch weth
  const weth = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    wethAddress
  )) as IERC20Minimal;

  // Fetch GLP Margin Engine
  console.log("Fetching GLP ME...");
  const glpMarginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    glpMarginEngineAddress
  )) as MarginEngine;

  console.log("Fetching GLP VAMM...");
  // Fetch GLP VAMM
  const glpVamm = (await hre.ethers.getContractAt(
    "VAMM",
    glpVammAddress
  )) as VAMM;

  console.log("Deploying implementation...");
  const marginEngineFactory = await hre.ethers.getContractFactory(
    "MarginEngine"
  );

  const emergencyMarginEngineImpl =
    (await marginEngineFactory.deploy()) as MarginEngine;

  console.log("impl.", emergencyMarginEngineImpl.address);

  // Upgrade GLP margin engine
  console.log(`Upgrading ME (with owner ${await glpMarginEngine.owner()})...`);
  await glpMarginEngine
    .connect(multisig)
    .upgradeTo(emergencyMarginEngineImpl.address);

  // Set custom settlement amounts
  console.log("Setting custom settlement amounts...");

  try {
    await glpMarginEngine
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

      await glpMarginEngine.connect(multisig).setCustomSettlements(batch);
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
  await weth.connect(multisig).transfer(glpMarginEngineAddress, toBn(143));

  {
    const balance = await weth.balanceOf(glpMarginEngineAddress);
    console.log(
      "initial balance of ME:",
      hre.ethers.utils.formatEther(balance)
    );
  }

  // Unpause contract
  await glpVamm.connect(pauser).setPausability(false);

  // Users withdraw
  console.log("Settling positions...");

  const header = "owner,tickLower,tickUpper,amount";
  fs.writeFile("tasks/glp_output_amounts.csv", header + "\n", () => {});

  for (const p of positions) {
    const wallet = await getSigner(hre, p.owner);

    const walletA = await weth.balanceOf(p.owner);

    try {
      await periphery
        .connect(wallet)
        .settlePositionAndWithdrawMargin(
          glpMarginEngineAddress,
          p.owner,
          p.tickLower,
          p.tickUpper
        );
    } catch (error) {
      if (p.amount !== "0") {
        throw error;
      }
    }

    const walletB = await weth.balanceOf(p.owner);

    const row = `${p.owner},${p.tickLower},${
      p.tickUpper
    },${hre.ethers.utils.formatEther(walletB.sub(walletA))}`;
    fs.appendFileSync("tasks/glp_output_amounts.csv", row + "\n");
  }

  // Check margin engine balance and users' wallets
  console.log("Checking balances...");
  {
    const balance = await weth.balanceOf(glpMarginEngineAddress);
    console.log("final balance of ME:", hre.ethers.utils.formatEther(balance));
  }

  console.log(
    `Done all simulations (ME with owner ${await glpMarginEngine.owner()}).`
  );
});

module.exports = {};
