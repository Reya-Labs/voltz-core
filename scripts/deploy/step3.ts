import {
  Deployment,
  validAddress,
  deployWithName,
  getContractFromDeployment,
} from "../helpers/deployHelpers";
import { BigNumber as BN, utils } from "ethers";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";

import { Factory } from "../../typechain";
import { getCurrentTimestamp } from "../../test/helpers/time";

const { provider } = waffle;

export async function step3(deployer: any, hre: any, deployment: Deployment) {
  // deploy the vAMM
  // deploy the MarginEngine
  const factory: Factory = await getContractFromDeployment(
    hre,
    deployment,
    "Factory"
  );
  const ammAddress: string = deployment.contracts.AMM1.address;
  await factory.createVAMM(ammAddress);
}

// todo: need steps which properly initialise critical protocol parameters
