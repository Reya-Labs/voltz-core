import { task } from "hardhat/config";
import { Factory } from "../typechain";

task("setPeriphery", "Sets the periphery")
  .addParam("factory", "The address of the Factory contract")
  .addParam("peripheryProxy", "The address of the Periphery proxy contract")
  .setAction(async (taskArgs, hre) => {
    // todo: make settable or extend the deployment scripts to enable this
    const factoryAddress = taskArgs.factory;

    const peripheryAddress = taskArgs.peripheryProxy; // proxy

    const factory = (await hre.ethers.getContractAt(
      "Factory",
      factoryAddress
    )) as Factory;

    // set the periphery in the factory
    const trx = await factory.setPeriphery(peripheryAddress, {
      gasLimit: 10000000,
    });
    await trx.wait();
  });

module.exports = {};
