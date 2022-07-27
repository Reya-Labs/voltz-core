import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Periphery } from "../typechain";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer, multisig } = await hre.getNamedAccounts();

  let weth: string | undefined;
  {
    const config = getConfig(hre.network.name);
    if (config.weth) {
      weth = config.weth;
    } else {
      const wethContract = await ethers.getContractOrNull("MockWETH");

      if (wethContract) {
        weth = wethContract.address;
      }
    }
    console.log(`The address of WETH9 for this environment is ${weth}`);
    if (!weth) {
      throw new Error("WETH not deployed");
    }
  }

  const proxyDeployResult = await deploy("Periphery", {
    contract: "Periphery",
    from: deployer,
    proxy: {
      owner: deployer,
      proxyContract: "ERC1967Proxy",
      proxyArgs: ["{implementation}", "{data}"],
      /* execute: {
        init: {
          methodName: "initialize",
          args: [weth],
        },
      }, */
    },
    log: true,
  });

  const proxyAddress = proxyDeployResult.address;

  const peripheryProxyInstance = (await hre.ethers.getContractAt(
    "Periphery",
    proxyAddress
  )) as Periphery;

  // initialise

  const tx_init = await peripheryProxyInstance.initialize(weth);
  await tx_init.wait();

  const owner_before = await peripheryProxyInstance.owner();
  console.log("Owner Proxy before: ", owner_before);

  const weth_after = await peripheryProxyInstance.weth();
  console.log("WETH address: ", weth_after);

  if (multisig !== deployer) {
    // Transfer ownership
    console.log(
      `Transferred ownership of Periphery Proxy at ${proxyAddress} to ${multisig}`
    );
    const tx_ow = await peripheryProxyInstance.transferOwnership(multisig);
    await tx_ow.wait();
  }

  const owner = await peripheryProxyInstance.owner();
  console.log("Owner Proxy: ", owner);

  return true; // Only execute once
};
func.tags = ["PeripheryProxy"];
func.id = "PeripheryProxy";
export default func;
