import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";
import { Factory } from "../typechain";

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

  // Mock PERIPHERY
  const dummyPeriphery = await deploy("PeripheryOld", {
    from: deployer,
    log: doLogging,
    args: [weth],
  });

  const dummyPeripheryContract = await ethers.getContractAt(
    "PeripheryOld",
    dummyPeriphery.address
  );

  // set it in factory

  const factory = (await ethers.getContract("Factory")) as Factory;
  const trx = await factory.setPeriphery(dummyPeripheryContract.address, {
    gasLimit: 10000000,
  });
  await trx.wait();

  return true; // Only execute once
};
func.tags = ["DummyPeriphery"];
func.id = "DummyPeriphery";
export default func;
