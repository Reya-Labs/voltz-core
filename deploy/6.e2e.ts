import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  await deploy("E2ESetup", {
    from: deployer,
    log: doLogging,
  });

  const numActors = 1;
  for (let i = 0; i < numActors; i++) {
    await deploy("Actor", {
      from: deployer,
      log: doLogging,
    });
  }

  return true; // Only execute once
};
func.tags = ["E2E"];
func.id = "E2E";
export default func;
