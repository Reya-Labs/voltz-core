import { Deployment, deployWithName } from "../helpers/deployHelpers";

export async function step0(deployer: any, hre: any, deployment: Deployment) {
  await deployWithName(hre, deployment, "Factory", "Factory", []);
}
