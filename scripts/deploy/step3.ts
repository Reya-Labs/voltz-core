import {
  Deployment,
  getContractFromDeployment,
} from "../helpers/deployHelpers";

import { Factory } from "../../typechain";

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

// need steps which properly initialise critical protocol parameters
