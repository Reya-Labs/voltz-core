import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getConfig } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const doLogging = true;

    // To have a hardhat node instance mine at intervals (rather than automine) throughout deployment, uncomment these lines
    // await hre.ethers.provider.send("evm_setAutomine", [false]);
    // await hre.ethers.provider.send("evm_setIntervalMining", [13500]);

    // Factory, and master contracts that get cloned for each IRS instance
    const masterMarginEngineDeploy = await deploy("MarginEngine", {
      from: deployer,
      log: doLogging,
    });
    const masterVammDeploy = await deploy("VAMM", {
      from: deployer,
      log: doLogging,
    });

    const skipFactory = getConfig(hre.network.name).skipFactoryDeploy;
    if (!skipFactory) {
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
