import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Factory } from "../typechain";
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

  const periphery = await deploy("Periphery", {
    from: deployer,
    log: doLogging,
    args: [weth],
  });

  // set the periphery in the factory
  const skipFactoryConfig = getConfig(hre.network.name).factoryOwnedByMultisig;
  if (skipFactoryConfig) {
    console.log(
      `!! SKIPPING FACTORY CONFIG. CALL setPeriphery("${periphery.address}") from multisig.`
    );
  } else {
    const factory = (await ethers.getContract("Factory")) as Factory;
    const trx = await factory.setPeriphery(periphery.address, {
      gasLimit: 10000000,
    });
    await trx.wait();
  }

  return true; // Only execute once
};
func.tags = ["Periphery"];
func.id = "Periphery";
export default func;
