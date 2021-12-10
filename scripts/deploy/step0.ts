import {
  Deployment,
  validAddress,
  deployWithName,
} from "../helpers/deployHelpers";
import { BigNumber as BN } from "ethers";

export async function step0(deployer: any, hre: any, deployment: Deployment) {
  await deployWithName(hre, deployment, "Factory", "Factory", []);
}
