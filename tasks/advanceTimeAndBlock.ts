import { task } from "hardhat/config";

// yarn deploy:mainnet_fork
///// aUSDC_v2, aDAI_v2, cDAI_v2, aETH?
// npx hardhat --network localhost createIrsInstance --pool --term-end-timestamp 0
// rm -rf deployments/localhost && cp -p -r deployments/mainnet deployments/localhost
// npx hardhat --network localhost advanceTimeAndBlock --time 9000 --blocks 1

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
