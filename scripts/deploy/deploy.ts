/* eslint-disable no-process-exit */

import hre from "hardhat";
import fs from "fs";
import path from "path";

import { devConstants, mainnetConstants } from "../helpers/constants";

import { Deployment, getDeployment } from "../helpers/deployHelpers";
import { step0 } from "./step0";
import { step1 } from "./step1";
import { step2 } from "./step2";
import { step3 } from "./step3";

const NUMBER_OF_STEPS = 3;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let deployment: Deployment;
  let consts: any;

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (network === "mainnet") {
    consts = mainnetConstants;
  } else {
    consts = devConstants;
  }

  if (fs.existsSync(filePath)) {
    // const
    deployment = getDeployment(filePath);
    console.log(`\tThere is an existing deployment`);
  } else {
    console.log(`\tNo existing deployment file`);
    deployment = {
      step: -1,
      contracts: {},
      variables: {},
      directories: [],
    };
  }

  if (process.env.RESET === "true") {
    console.log(`\tRESETing, deploying a brand new instance of contracts`);
    deployment.step = -1;
  }

  const lastStep =
    process.env.LAST_STEP != null
      ? parseInt!(process.env.LAST_STEP)
      : NUMBER_OF_STEPS;
  console.log(
    `======= Deploying from step ${deployment.step} to step ${lastStep}`
  );
  console.log(`\nSetting Environment Variables`);
  // beforeAll() in here if necessary

  for (let step = deployment.step + 1; step <= lastStep; step++) {
    switch (step) {
      case 0: {
        console.log(`\n[Step ${step}]: Deploying the Factory Contract`);
        await step0(deployer, hre, deployment);
        break;
      }

      case 1: {
        console.log(`\n[Step ${step}]: Deploying an AMM Contract`);
        await step1(deployer, hre, deployment, consts);
        break;
      }

      case 2: {
        console.log(`\n[Step ${step}]: Deploying an VAMM Contract`);
        await step2(deployer, hre, deployment);
        break;
      }

      case 3: {
        console.log(`\n[Step ${step}]: Deploying a Margin Engine Contract`);
        await step3(deployer, hre, deployment);
        break;
      }

      default: {
        break;
      }
    }

    deployment.step = step;
    console.log(`\tsaving updated deployment data`);
    fs.writeFileSync(filePath, JSON.stringify(deployment, null, "  "), "utf8");
    console.log(
      `[Step ${step} - Done]: saved updated deployment data for step ${step}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
