import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseBalanceMap } from "../deployConfig/parse-balance-map";
import fs from 'fs'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  try {
    const { deploy } = hre.deployments;
    const { deployer } = await hre.getNamedAccounts();
    const doLogging = true;

    // Factory, and master contracts that get cloned for each IRS instance
    const masterMarginEngineDeploy = await deploy("MarginEngine", {
      from: deployer,
      log: doLogging,
    });
    const masterVammDeploy = await deploy("VAMM", {
      from: deployer,
      log: doLogging,
    });

    const json = JSON.parse(fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: 'utf8' }));
    const merkleDistributorInfo = JSON.stringify(parseBalanceMap(json));
    console.log(merkleDistributorInfo);

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["Factory"];
func.id = "Factory";
export default func;
