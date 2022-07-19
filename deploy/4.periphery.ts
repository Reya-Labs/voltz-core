import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Periphery } from "../typechain";
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

  const peripheryImpl = await deploy("Periphery", {
    from: deployer,
    log: doLogging,
  });

  const peripheryProxy = await deploy("VoltzERC1967Proxy", {
    from: deployer,
    log: doLogging,
    args: [peripheryImpl.address, []],
  });

  console.log("Proxy address: ", peripheryProxy.address);
  console.log("Impl address: ", peripheryImpl.address);

  const peripheryProxyInstance = (await hre.ethers.getContractAt(
    "Periphery",
    peripheryProxy.address
  )) as Periphery;

  const tx_init = await peripheryProxyInstance.initialize();
  await tx_init.wait();

  const owner = await peripheryProxyInstance.owner();
  console.log("Owner Proxy: ", owner);

  const tx = await peripheryProxyInstance.setWeth(weth);
  await tx.wait();

  return true; // Only execute once
};
func.tags = ["Periphery"];
func.id = "Periphery";
export default func;
