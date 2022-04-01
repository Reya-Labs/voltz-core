import { task } from "hardhat/config";

task("setIntervalMining", "Set interval mining").setAction(async (_, hre) => {
  await hre.network.provider.send("evm_setIntervalMining", [5000]);
});

module.exports = {};
