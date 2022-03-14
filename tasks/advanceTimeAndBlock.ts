import { task } from "hardhat/config";

task("advanceTimeAndBlock", "Advance Time and Block")
  .addParam("time", "Time")
  .addParam("blocks", "Number of Blocks")
  .setAction(async (taskArgs, hre) => {
    const time = parseInt(taskArgs.time);
    const blocks = parseInt(taskArgs.blocks);

    await hre.network.provider.send("evm_increaseTime", [time]);
    for (let i = 0; i < blocks; i++) {
      await hre.network.provider.send("evm_mine", []);
    }
  });

module.exports = {};
