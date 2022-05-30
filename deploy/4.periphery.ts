import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Factory } from "../typechain";
import { ethers } from "hardhat";
import { factoryOwnedByMultisig } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;
  const factory = (await ethers.getContract("Factory")) as Factory;

  const periphery = await deploy("Periphery", {
    from: deployer,
    log: doLogging,
  });

  // set the periphery in the factory
  const skipFactoryConfig = factoryOwnedByMultisig(hre.network.name);
  if (skipFactoryConfig) {
    console.log(
      `!! SKIPPING FACTORY CONFIG. CALL setPeriphery("${periphery.address}") from multisig.`
    );
  } else {
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
