import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";


// todo: need a more elegant way to handle factory deployed via the community manager
const DEPLOY_FACTORY: boolean = false;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
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

    if (DEPLOY_FACTORY) {
      await deploy("Factory", {
        from: deployer,
        args: [masterMarginEngineDeploy.address, masterVammDeploy.address],
        log: doLogging,
      });
    }

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["Factory"];
func.id = "Factory";
export default func;
