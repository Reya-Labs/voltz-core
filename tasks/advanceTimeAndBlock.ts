import { task } from "hardhat/config";

// Description:
//   This task advances time and block on localhost network.
//
// Example:
//   ``npx hardhat advanceTimeAndBlock --network localhost --time 86400 --blocks 7200``

task("advanceTimeAndBlock", "Advance Time and Block")
  .addParam("time", "Time")
  .addParam("blocks", "Number of Blocks")
  .setAction(async (taskArgs, hre) => {
    if (!(hre.network.name === "localhost")) {
      throw new Error(
        `Can't advance time or block on network ${hre.network.name}`
      );
    }

    const time = parseInt(taskArgs.time);
    const blocks = parseInt(taskArgs.blocks);

    await hre.network.provider.send("evm_increaseTime", [time]);
    for (let i = 0; i < blocks; i++) {
      await hre.network.provider.send("evm_mine", []);
    }
  });

module.exports = {};
