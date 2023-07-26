import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { FeeCollector } from "../typechain";
import { getConfig } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const config = getConfig(hre.network.name);
  const multisig = config.multisig;

  const proxyDeployResult = await deploy("FeeCollector", {
    contract: "FeeCollector",
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
    log: true,
  });

  const proxyAddress = proxyDeployResult.address;
  console.log("proxyAddress ", proxyAddress);

  const feeCollectorProxyInstance = (await hre.ethers.getContractAt(
    "FeeCollector",
    proxyAddress
  )) as FeeCollector;

  if (multisig !== deployer && multisig) {
    // Transfer ownership
    console.log(
      `Transferred ownership of FeeCollector Proxy at ${proxyAddress} to ${multisig}`
    );
    const trx = await feeCollectorProxyInstance.transferOwnership(multisig);
    await trx.wait();
  }

  const owner = await feeCollectorProxyInstance.owner();
  console.log("Owner Proxy: ", owner);

  return true; // Only execute once
};
func.tags = ["FeeCollectorProxy"];
func.id = "FeeCollectorProxy";
export default func;
