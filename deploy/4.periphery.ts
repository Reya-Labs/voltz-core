import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  await deploy("Periphery", {
    from: deployer,
    log: doLogging,
  });
  return true; // Only execute once
};
func.tags = ["Periphery"];
func.id = "Periphery";
export default func;
