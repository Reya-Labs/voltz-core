import { task } from "hardhat/config";

task("setPeriphery", "Sets the periphery")
  .addParam("peripheryProxy", "The address of the Periphery proxy contract")
  .setAction(async (taskArgs, hre) => {
    const peripheryAddress = taskArgs.peripheryProxy; // proxy

    const factory = await hre.ethers.getContract("Factory");

    // set the periphery in the factory
    const trx = await factory.setPeriphery(peripheryAddress, {
      gasLimit: 10000000,
    });
    await trx.wait();
  });

module.exports = {};
