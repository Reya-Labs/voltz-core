import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  const config = getConfig(hre.network.name);

  let weth: string | undefined;
  if (config.weth) {
    weth = config.weth;
  } else {
    const wethContract = await ethers.getContractOrNull("MockWETH");

    if (wethContract) {
      weth = wethContract.address;
    }
  }

  console.log(`The address of WETH9 for this environment is ${weth}`);
  if (!weth) {
    throw new Error("WETH not deployed");
  }

  const peripheryImpl = await deploy("Periphery_Implementation", {
    from: deployer,
    log: doLogging,
  });
  console.log("Impl address: ", peripheryImpl.address);

  return true; // Only execute once
};
func.tags = ["NewPeripheryImpl"];
func.id = "NewPeripheryImpl";
export default func;
