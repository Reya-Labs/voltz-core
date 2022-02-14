import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  // Factory, and master contracts that get cloned for each IRS instance
  const masterMarginEngineDeploy = await deploy("MarginEngine", {
    from: deployer,
    log: doLogging,
  });
  const masterVammDeploy = await deploy("VAMM", {
    from: deployer,
    log: doLogging,
  });
  await deploy("Factory", {
    from: deployer,
    args: [masterMarginEngineDeploy.address, masterVammDeploy.address],
    log: doLogging,
  });
};
func.tags = ["Factory"];
export default func;
