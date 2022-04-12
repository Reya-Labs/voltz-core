import { task } from "hardhat/config";
import { Factory } from "../typechain";

task("setPeriphery", "Sets the periphery").setAction(async (_, hre) => {
  // todo: make settable or extend the deployment scripts to enable this
  const factoryAddress = "0xAF47e8353729E5be6cA4f605dd176B7Fc80EDA08";

  const peripheryAddress = "0x57E674032784932Ac981e177B9f9287f57d1Eda0";

  const factory = (await hre.ethers.getContractAt(
    "Factory",
    factoryAddress
  )) as Factory;

  // set the periphery in the factory
  const trx = await factory.setPeriphery(peripheryAddress);
  await trx.wait();
});

module.exports = {};
