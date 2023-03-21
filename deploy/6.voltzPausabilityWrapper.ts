import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { getConfig } from "../deployConfig/config";
import { VoltzPausabilityWrapper } from "../typechain";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const doLogging = true;

    // Retrieve multisig address for the current network
    const network = hre.network.name;
    const deployConfig = getConfig(network);
    const multisig = deployConfig.multisig;

    // Voltz Pausability Wrapper deployment
    const deployResult = await deploy("VoltzPausabilityWrapper", {
      from: deployer,
      log: doLogging,
    });

    const voltzPausabilityWrapper = (await hre.ethers.getContractAt(
      "VoltzPausabilityWrapper",
      deployResult.address
    )) as VoltzPausabilityWrapper;

    if (!((await voltzPausabilityWrapper.owner()) === multisig)) {
      console.log("Transferring to multisig...");
      const tx = await voltzPausabilityWrapper.transferOwnership(multisig);
      await tx.wait();
    }

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["VoltzPausabilityWrapper"];
func.id = "VoltzPausabilityWrapper";
export default func;
