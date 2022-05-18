import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseBalanceMap } from "../deployConfig/parse-balance-map";
import { MerkleDistributorInfo } from "../deployConfig/parse-balance-map";
import fs from "fs";


const QUORUM_VOTES = 185;
const VOLTZ_GENESIS_NFT_ADDRESS = "0x8C7E68e7706842BFc70053C4cED21500488e73a8";
const MULTISIG_ADDRESS = ""; // todo: create a gnosis safe


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

    const json = JSON.parse(
      fs.readFileSync("deployConfig/nftSnapshot.json", { encoding: "utf8" })
    );
    const merkleDistributorInfo: MerkleDistributorInfo = parseBalanceMap(json);

    console.log("Total Genesis NFT count", merkleDistributorInfo.tokenTotal);
    console.log("Merkle Root", merkleDistributorInfo.merkleRoot);
    console.log("First User Info: ", merkleDistributorInfo.claims[0]);

    const communityDeployer = await deploy("CommunityDeployer", {
      from: deployer,
      log: doLogging,
      args: [masterVammDeploy.address, masterMarginEngineDeploy.address, VOLTZ_GENESIS_NFT_ADDRESS, QUORUM_VOTES, MULTISIG_ADDRESS, merkleDistributorInfo.merkleRoot]
    });

    console.log("Community Deployer Address: ", communityDeployer.address);

    return true; // Only execute once
  } catch (e) {
    console.error(e);
    throw e;
  }
};
func.tags = ["Factory"];
func.id = "Factory";
export default func;
