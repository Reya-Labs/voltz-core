import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.live) {
    console.log(
      "\nIf new contracts were deployed, please verify them now before making any other changes:"
    );
    console.log(`\tnpx hardhat --network ${hre.network.name} etherscan-verify`);
    console.log("See readme for troubleshooting or additional details.");
  }
};
func.tags = ["Messages"];
export default func;
